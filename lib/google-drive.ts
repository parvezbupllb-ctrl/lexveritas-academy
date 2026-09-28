// Drive access is limited to files and folders created by this application.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export const driveRedirectUri = (env: Record<string, any>) =>
  String(env.GOOGLE_OAUTH_REDIRECT_URI || "https://lexveritasacademy.sites.bd/api/admin/backup/google/callback");
export const driveConfigured = (env: Record<string, any>) =>
  Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.BACKUP_TOKEN_KEY);

const base64url = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const sha256url = async (value: string) =>
  base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));

async function aesKey(env: Record<string, any>) {
  const bytes = Uint8Array.from(atob(String(env.BACKUP_TOKEN_KEY || "")), c => c.charCodeAt(0));
  if (bytes.length !== 32) throw Error("Backup token encryption key is not configured.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function sealRefreshToken(env: Record<string, any>, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv}, await aesKey(env), new TextEncoder().encode(value)));
  return base64url(new Uint8Array([...iv,...ciphertext]));
}
export async function openRefreshToken(env: Record<string, any>, value: string) {
  const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes.slice(0,12)}, await aesKey(env), bytes.slice(12));
  return new TextDecoder().decode(plaintext);
}

export function authorizationUrl(env: Record<string, any>, state: string, challenge: string, email: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key,value] of Object.entries({
    client_id:String(env.GOOGLE_OAUTH_CLIENT_ID),redirect_uri:driveRedirectUri(env),
    response_type:"code",scope:DRIVE_SCOPE,access_type:"offline",prompt:"consent",
    state,code_challenge:challenge,code_challenge_method:"S256",login_hint:email,
  })) url.searchParams.set(key,value);
  return url.toString();
}
async function googleError(response: Response) {
  const body = await response.json().catch(()=>({})) as any;
  const message = body.error?.message || body.error_description || body.error || response.statusText;
  throw Error(`Google Drive request failed (${response.status}): ${String(message).slice(0,200)}`);
}
async function exchange(env: Record<string, any>, body: URLSearchParams) {
  body.set("client_id",String(env.GOOGLE_OAUTH_CLIENT_ID));
  body.set("client_secret",String(env.GOOGLE_OAUTH_CLIENT_SECRET));
  const response = await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,
  });
  if(!response.ok) await googleError(response);
  return await response.json() as {access_token:string;refresh_token?:string;scope?:string};
}
export const exchangeCode = (env: Record<string, any>,code:string,verifier:string) =>
  exchange(env,new URLSearchParams({grant_type:"authorization_code",code,code_verifier:verifier,redirect_uri:driveRedirectUri(env)}));
export const refreshAccess = (env: Record<string, any>,refresh:string) =>
  exchange(env,new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh}));

export class DriveClient {
  constructor(private accessToken:string){}
  private async request(url:string,init:RequestInit={}) {
    const response=await fetch(url,{...init,headers:{Authorization:`Bearer ${this.accessToken}`,...(init.headers || {})}});
    if(!response.ok) await googleError(response);
    return response;
  }
  async accountEmail() {
    const data=await (await this.request(`${DRIVE_API}/about?fields=user(emailAddress)`)).json() as any;
    return String(data.user?.emailAddress || "").toLowerCase();
  }
  async file(id:string) {
    const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,trashed,webViewLink`,{headers:{Authorization:`Bearer ${this.accessToken}`}});
    if(response.status===404)return null;
    if(!response.ok)await googleError(response);
    return await response.json() as any;
  }
  async folder(name:string,parent?:string) {
    const data=await (await this.request(`${DRIVE_API}/files?fields=id,name,webViewLink`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",...(parent?{parents:[parent]}:{})}),
    })).json() as any;
    if(!data.id) throw Error("Google Drive did not return a folder ID.");
    return data;
  }
  async children(folderId:string) {
    const files:any[]=[];let pageToken="";
    do {
      const url=new URL(`${DRIVE_API}/files`);
      url.searchParams.set("q",`'${folderId.replace(/'/g,"\\'")}' in parents and trashed = false`);
      url.searchParams.set("fields","nextPageToken,files(id,name,size,mimeType,webViewLink)");
      url.searchParams.set("pageSize","1000");
      if(pageToken)url.searchParams.set("pageToken",pageToken);
      const page=await (await this.request(url.toString())).json() as any;
      files.push(...(page.files||[]));pageToken=page.nextPageToken||"";
    }while(pageToken);
    return files;
  }
  async upload(name:string,mime:string,size:number,body:ReadableStream<Uint8Array>|Uint8Array,folderId:string) {
    const session=await this.request(`${DRIVE_UPLOAD}?uploadType=resumable&fields=id,name,size,webViewLink`,{
      method:"POST",headers:{"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mime,"X-Upload-Content-Length":String(size)},
      body:JSON.stringify({name,mimeType:mime,parents:[folderId]}),
    });
    const location=session.headers.get("Location");
    if(!location || !location.startsWith("https://www.googleapis.com/")) throw Error("Drive upload session is unavailable.");
    const uploaded=await this.request(location,{
      method:"PUT",headers:{"Content-Type":mime,"Content-Length":String(size),...(size?{"Content-Range":`bytes 0-${size-1}/${size}`}:{})},
      body:body as BodyInit,duplex:"half",
    } as RequestInit & {duplex:string});
    const result=await uploaded.json() as any;
    if(!result.id || Number(result.size)!==size)throw Error(`Drive copy size mismatch: ${name}`);
    return result;
  }
}
