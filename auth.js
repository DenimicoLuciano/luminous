import jwt from 'jsonwebtoken';
export function requireAuth(req,res,next){const h=req.headers.authorization||'';try{if(!h.startsWith('Bearer '))throw 0;req.user=jwt.verify(h.slice(7),process.env.JWT_SECRET);next();}catch{return res.status(401).json({error:'Please log in again.'});}}
export const makeToken=u=>jwt.sign({id:u.id,username:u.username},process.env.JWT_SECRET,{expiresIn:'14d'});
