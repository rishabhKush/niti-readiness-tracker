import { getUser } from "@netlify/identity";
import { getStore } from "@netlify/blobs";

const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const validState=value=>value&&typeof value==="object"&&value.meta&&Array.isArray(value.tasks)&&value.meta.targetDate==="2026-12-31";

export default async request=>{
  const user=await getUser();
  if(!user)return json({error:"Unauthorized"},401);
  const store=getStore({name:"niti-tracker-state",consistency:"strong"});
  const key=`users/${user.id}.json`;
  const current=await store.get(key,{type:"json",consistency:"strong"});
  if(request.method==="GET")return json({revision:current?.revision||0,state:current?.state||null});
  if(request.method!=="PUT")return json({error:"Method not allowed"},405);
  let body;
  try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  if(!validState(body.state)||!Number.isInteger(body.baseRevision)||body.baseRevision<0)return json({error:"Invalid tracker state"},400);
  const actual=current?.revision||0;
  if(body.baseRevision!==actual)return json({error:"Conflict",revision:actual},409);
  const next={revision:actual+1,updatedAt:new Date().toISOString(),state:body.state};
  await store.set(key,JSON.stringify(next));
  return json({revision:next.revision,updatedAt:next.updatedAt});
};
