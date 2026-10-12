import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomUUID, createHash } from 'node:crypto';
import type { AppData } from '../src/types';
import { effectiveData, interpretSession } from '../src/domain/evidence';
import { readAppData, getDataDir } from './storage';
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  filename: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.filename.replace(/\\/g, '/'), 'utf-8');
    const uncompressed = entry.data;
    const compressed = zlib.deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x800, 6); // UTF-8 filenames
    localHeader.writeUInt16LE(8, 8); // compression method (deflate)
    localHeader.writeUInt16LE(0, 10); // file time
    localHeader.writeUInt16LE(0, 12); // file date
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(uncompressed.length, 22); // uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length
    filenameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    // Central directory file header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x800, 8); // UTF-8
    centralHeader.writeUInt16LE(8, 10); // method (deflate)
    centralHeader.writeUInt16LE(0, 12); // time
    centralHeader.writeUInt16LE(0, 14); // date
    centralHeader.writeUInt32LE(crc, 16); // crc-32
    centralHeader.writeUInt32LE(compressed.length, 20); // compressed size
    centralHeader.writeUInt32LE(uncompressed.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(filenameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirBuf = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuf.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // total entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries in central dir
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}


const identifier=(id:string)=>Buffer.from(id).toString('hex');
const json=(value:unknown)=>JSON.stringify(value,null,2);
const block=(value:unknown)=>'\n~~~~json\n'+json(value)+'\n~~~~\n';
export function runMarkdownExport(outputDir=path.join(getDataDir(),'exports'), dataOverride?:AppData, _timeZone?:string) {
 const raw=structuredClone(dataOverride||readAppData()), data=effectiveData(raw), now=new Date();
 const exportId=randomUUID(), exportDir=path.join(outputDir,exportId);
 fs.mkdirSync(exportDir,{recursive:true});
 const files:ZipEntry[]=[];
 const add=(filename:string,value:string)=>{files.push({filename,data:Buffer.from(value)});const file=path.join(exportDir,filename);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,{flag:'wx'});};
 add('canonical.json',json(raw));
 add('effective.json',json(data));
 const summaries:Record<string,unknown>={};
 for(const s of data.sessions) {
   const original=raw.sessions.find(r=>r.id===s.id);
   const entries=data.entries.filter(e=>e.session_id===s.id), rawEntries=raw.entries.filter(e=>e.session_id===s.id);
   const {nodeMinutes,...summary}=interpretSession(s,entries,now);
   summaries[s.id]={...summary,nodeMinutes:Object.fromEntries(nodeMinutes)};
   const parent='Things/'+identifier(s.journey_id);
   const reportIds=new Set(rawEntries.map(e=>e.source_report_id).filter(Boolean));
   const text='# Session '+s.id+'\n\n## Original intention\n'+(original?.intention||'(unknown)')+'\n\nProvenance: '+(original?.intention_provenance||'legacy_unknown')+'; retrospective wording is not a declaration at start.\n'
    +'\n## Interpreted time\nSupported activity: '+summary.activeMinutes+' minutes. Unclassified: '+summary.unclassifiedPauseMinutes+' minutes. Bounds known: '+summary.validBounds+'. Open: '+summary.open+'.\n'
    +block(summaries[s.id])+'\n## Original Session\n'+block(original)+'\n## Effective Session\n'+block(s)
    +'\n## Original entries (including Node references and Conditions)\n'+block(rawEntries)+'\n## Effective entries\n'+block(entries)
    +'\n## Reports and confirmations\n'+block((raw.capture_reports||[]).filter(r=>reportIds.has(r.id)||r.session_id===s.id))
    +'\n## Revisions\n'+block((raw.intention_revisions||[]).filter(r=>r.session_id===s.id))
    +'\n## Corrections\n'+block(raw.corrections.filter(c=>rawEntries.some(e=>e.id===c.entry_id)))
    +'\n## Amendments\n'+block((raw.session_amendments||[]).filter(a=>a.session_id===s.id))
    +'\n## Conflicts\n'+block(raw.conflicts.filter(c=>c.session_id===s.id))
    +'\n## Transition links\n'+block({predecessor:s.predecessor_session_id,successor:s.successor_session_id});
   add(parent+'/Sessions/'+identifier(s.id)+'.md',text);
 }
 for(const j of data.journeys) add('Things/'+identifier(j.id)+'/Thing.md','# '+j.name+'\n'+block(j));
 for(const n of data.nodes) {
   const sessions=data.sessions.filter(s=>s.journey_id===n.journey_id && data.entries.some(e=>e.session_id===s.id&&(e.node_id===n.id||e.discovery_ref===n.id)));
   add('Things/'+identifier(n.journey_id)+'/Nodes/'+identifier(n.id)+'.md','# '+n.name+'\n'+block(n)+'\n## Session references\n'+sessions.map(s=>'- [Session '+s.id+'](../Sessions/'+identifier(s.id)+'.md)').join('\n'));
 }
 add('summaries.json',json(summaries));
 add('README.md','# Evidence snapshot\n\ncanonical.json contains the complete selected application dataset, including unknown fields and all supporting histories. effective.json applies corrections and amendments without replacing originals. Each Session has one document under its Thing, including Sessions with no Node. Node files reference those documents. summaries.json uses the same interpreter as Board, history and query summaries.\n\nCredentials, signing keys, prior exports and unrelated files are excluded. Open bounds are provisional at the manifest timestamp. Invalid bounds/entries remain in canonical evidence and are identified in interpretation issues. No unsupported time is distributed across Nodes.\n');
 add('manifest.json',json({format:1,export_id:exportId,created_at:now.toISOString(),scope:'Complete application JSON plus readable Thing/Node/Session documents',omissions:['Credentials and signing keys','Previous exports','Unrelated files'],files:files.map(f=>({path:f.filename,sha256:createHash('sha256').update(f.data).digest('hex')}))}));
 const zipPath=path.join(exportDir,'human_drift_export.zip');
 fs.writeFileSync(zipPath,buildZip(files),{flag:'wx'});
 return {exportDir,zipPath,exportId};
}
