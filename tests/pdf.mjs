import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createWriteStream,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);const PdfPrinter=require('pdfmake');
await build({entryPoints:['lib/pdf-document.ts'],outfile:'.sites-runtime/tests/pdf-document.mjs',bundle:true,platform:'node',format:'esm'});
const {rankingDocument}=await import('../.sites-runtime/tests/pdf-document.mjs');
const font='public/fonts/NotoSansBengali-Regular.ttf',printer=new PdfPrinter({Latin:{normal:'public/fonts/Latin-Regular.ttf',bold:'public/fonts/Latin-Regular.ttf',italics:'public/fonts/Latin-Regular.ttf',bolditalics:'public/fonts/Latin-Regular.ttf'},Bengali:{normal:font,bold:font,italics:font,bolditalics:font}});
const d=rankingDocument({exam:{title:'BJS Preliminary Model Test - বাংলা পরীক্ষা',start:Date.now()},total:130,rows:Array.from({length:130},(_,i)=>({position:i+1,student_name:i%2?'রহিম উদ্দিন':'Ayesha Rahman',university:i%2?'ঢাকা বিশ্ববিদ্যালয়':'University of Dhaka',correct:70,wrong:20,unanswered:10,score:6500,duration:1230000}))});
mkdirSync('.sites-runtime/tests',{recursive:true});await new Promise((resolve,reject)=>{const out=createWriteStream('.sites-runtime/tests/ranking.pdf');out.on('finish',resolve);out.on('error',reject);const doc=printer.createPdfKitDocument(d);doc.pipe(out);doc.end()});console.log('Ranking PDF generated with 130 Bengali and English records.');
