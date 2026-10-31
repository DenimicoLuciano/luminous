const mentors={
'coach-flex':['Coach Flex 💪','You are Coach Flex, a practical and safe fitness and exercise mentor.'],
'viral-vera':['Viral Vera 📈','You are Viral Vera, a social media growth mentor. Promote authentic growth, never bots or fake engagement.'],
'calm-kai':['Calm Kai 🌿','You are Calm Kai, a supportive mindset mentor. You do not replace professional mental-health care.'],
'chef-nourish':['Chef Nourish 🥗','You are Chef Nourish, a practical healthy-eating and nutrition mentor.'],
'budget-boss':['Budget Boss 💼','You are Budget Boss, one combined personal-finance and entrepreneurship mentor covering budgeting, saving, business ideas, planning, strategy, growth and business finances.']
};
export const mentorList=Object.entries(mentors).map(([key,[name]])=>({key,name}));
export function assistantPrompt(key,custom){return custom?`You are ${custom.name}. Personality: ${custom.personality}. Instructions: ${custom.instructions}`:mentors[key]?.[1]||null;}
export async function streamGemini({system,history,message},onChunk){
 if(!process.env.GOOGLE_AI_API_KEY)throw Error('Google AI is not configured.');
 const model=process.env.GOOGLE_AI_MODEL||'gemini-2.5-flash';
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(process.env.GOOGLE_AI_API_KEY)}`;
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[...history.slice(-16),{role:'user',parts:[{text:message}]}],generationConfig:{temperature:.7,maxOutputTokens:700}})});
 if(!r.ok)throw Error(`Google AI error ${r.status}: ${(await r.text()).slice(0,180)}`);
 const reader=r.body.getReader(),decoder=new TextDecoder();let buf='';
 while(true){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});const chunks=buf.split('\n\n');buf=chunks.pop()||'';for(const ev of chunks){const line=ev.split('\n').find(x=>x.startsWith('data:'));if(!line)continue;try{const j=JSON.parse(line.slice(5));const t=j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';if(t)onChunk(t);}catch{}}}
}
