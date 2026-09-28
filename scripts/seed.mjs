import {randomBytes,randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const password=process.env.LVA_INITIAL_PASSWORD;
if(!password||password.length<14)throw Error('Set LVA_INITIAL_PASSWORD to a temporary password of at least 14 characters.');
const passwordHash=await hash(password,12),now=Date.now(),safe=s=>"'"+s.replaceAll("'","''")+"'";
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',codes=new Set();while(codes.size<10000){const s=Array.from(randomBytes(12),b=>alphabet[b%32]).join('');codes.add(`LVA-${s.slice(0,4)}-${s.slice(4,8)}-${s.slice(8)}`)}
mkdirSync('.sites-runtime/seed',{recursive:true});let sql=`INSERT OR IGNORE INTO admins(id,username,password_hash,must_change,created_at) VALUES(${safe(randomUUID())},'lexveritas_admin',${safe(passwordHash)},1,${now});\n`;
for(const code of codes)sql+=`INSERT INTO codes(id,code,active,created_at) SELECT ${safe(randomUUID())},${safe(code)},1,${now} WHERE (SELECT COUNT(*) FROM codes)<10000;\n`;
sql+="INSERT OR IGNORE INTO settings VALUES('initial_codes_seeded','true');\n";writeFileSync('.sites-runtime/seed/initial.sql',sql,{mode:0o600});writeFileSync('.env',`INITIAL_ADMIN_HASH='${passwordHash}'\n`,{mode:0o600});console.log('Prepared hashed admin credential and 10,000 random access codes in the private seed directory.');
