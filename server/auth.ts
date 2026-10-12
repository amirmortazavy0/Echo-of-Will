import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { getDataDir, DEFAULT_USER_ID, StorageError } from './storage';
export interface StoredUser { username:string; password_hash:string; created_at:string }
interface UsersData { users:StoredUser[] }
function usersPath() {
  const primary=path.join(getDataDir(),'users.json');
  const legacy=path.resolve('backend/users.json');
  return !process.env.PIST_DATA_DIR && !fs.existsSync(primary) && fs.existsSync(legacy) ? legacy : primary;
}
export function readUsers(): UsersData {
  if (!fs.existsSync(usersPath())) return {users:[]};
  let data:any; try { data=JSON.parse(fs.readFileSync(usersPath(),'utf8')); } catch { throw new StorageError('Credential file is unreadable; restore it explicitly rather than creating another owner'); }
  if (!Array.isArray(data.users) || data.users.some((u:any)=>typeof u.username!=='string'||typeof u.password_hash!=='string')) throw new StorageError('Invalid credential file');
  return data;
}
export function writeUsers(data:UsersData) {
  const file=usersPath(); fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=`${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp,JSON.stringify(data,null,2),{flag:'wx',mode:0o600}); fs.renameSync(temp,file);
}
function owner(): StoredUser | undefined {
  const users=readUsers().users;
  if (users.length>1) {
    const selected=users.find(u=>u.username===process.env.PIST_OWNER_USERNAME);
    if (!selected) throw new StorageError('Multiple legacy credentials found. Select the single local owner with PIST_OWNER_USERNAME; no accounts are deleted.');
    return selected;
  }
  return users[0];
}
function signingKey() {
  const file=path.join(getDataDir(),'.owner-signing-key');
  fs.mkdirSync(getDataDir(),{recursive:true});
  if (!fs.existsSync(file)) { try { fs.writeFileSync(file,crypto.randomBytes(48).toString('hex'),{flag:'wx',mode:0o600}); } catch(error:any) { if(error.code!=='EEXIST') throw error; } }
  const key=fs.readFileSync(file,'utf8'); if (!/^[0-9a-f]{96}$/.test(key)) throw new StorageError('Invalid owner signing key; do not silently replace it');
  return key;
}
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
export function createJwtToken(username:string) {
  const now=Math.floor(Date.now()/1000); const data=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:username,owner_id:DEFAULT_USER_ID,iat:now,exp:now+7*86400})}`;
  return `${data}.${crypto.createHmac('sha256',signingKey()).update(data).digest('base64url')}`;
}
export function verifyJwtToken(token:string): {username:string;owner_id:string}|null {
  try {
    const [header,payload,signature,...extra]=token.split('.'); if(extra.length||!signature) return null;
    if(JSON.parse(Buffer.from(header,'base64url').toString()).alg!=='HS256') return null;
    const expected=crypto.createHmac('sha256',signingKey()).update(`${header}.${payload}`).digest('base64url');
    if(signature.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(!Number.isInteger(data.exp)||data.exp<=Math.floor(Date.now()/1000)||data.owner_id!==DEFAULT_USER_ID||data.sub!==owner()?.username) return null;
    return {username:data.sub,owner_id:DEFAULT_USER_ID};
  } catch { return null; }
}
export async function signupUser(usernameRaw:string,password:string) {
  if(typeof usernameRaw!=='string'||!usernameRaw.trim()||usernameRaw.length>100||typeof password!=='string'||password.length<8||password.length>1024) throw new Error('Choose a username and a password of at least 8 characters');
  if(readUsers().users.length) throw new Error('Local owner already exists. Sign in; additional accounts are disabled.');
  const password_hash=await bcrypt.hash(password,10);
  // Recheck after the asynchronous hash: concurrent setup cannot create two owners.
  if(readUsers().users.length) throw new Error('Local owner already exists. Sign in.');
  const username=usernameRaw.trim(); signingKey();
  writeUsers({users:[{username,password_hash,created_at:new Date().toISOString()}]});
  return {token:createJwtToken(username),username};
}
export async function loginUser(usernameRaw:string,password:string) {
  const user=owner();
  if(typeof usernameRaw!=='string'||typeof password!=='string'||!user||user.username.toLowerCase()!==usernameRaw.trim().toLowerCase()||!await bcrypt.compare(password,user.password_hash)) throw new Error('Invalid local owner username or password');
  return {token:createJwtToken(user.username),username:user.username};
}
export interface AuthenticatedRequest extends Request {user?:{username:string;owner_id:string}}
export function expressAuthMiddleware(req:AuthenticatedRequest,res:Response,next:NextFunction) {
  if(['/auth/signup','/auth/login','/api/auth/signup','/api/auth/login','/api/health','/health'].includes(req.path)) return next();
  if(req.path.startsWith('/api/')||req.path==='/auth/me') {
    const header=req.headers.authorization;
    const verified=header?.startsWith('Bearer ')?verifyJwtToken(header.slice(7)):null;
    if(!verified) {res.status(401).json({detail:'Sign in as the local owner'});return;}
    req.user=verified;
  }
  next();
}
export function localBoundary(req:Request,res:Response,next:NextFunction) {
  let host:URL;
  try {host=new URL(`http://${req.headers.host}`);} catch {res.status(403).json({detail:'Invalid local host'});return;}
  if(!['127.0.0.1','localhost','[::1]'].includes(host.hostname)) {res.status(403).json({detail:'Only local loopback access is supported'});return;}
  if(req.headers.origin && req.headers.origin!==host.origin) {res.status(403).json({detail:'Cross-origin requests are disabled'});return;}
  if(['POST','PUT','PATCH'].includes(req.method)&&!req.is('application/json')) {res.status(415).json({detail:'Use application/json'});return;}
  next();
}
