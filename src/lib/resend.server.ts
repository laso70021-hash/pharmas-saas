export const escapeEmail=(s:string)=>s.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
/** Existing owner-supplied Resend key; direct API, not a connector connection key. */
export async function sendAppEmail(to:string,subject:string,text:string,key:string,html?:string){
 const apiKey=process.env['RESEND_API_KEY'];if(!apiKey)throw new Error('Email sending is not configured.');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:'Swahivo <info@swahivo.com>',to:[to],reply_to:'info@swahivo.com',subject,text,...(html?{html}:{})})});
 if(!response.ok){console.error('Resend delivery failed',response.status,await response.text());throw new Error(`Email was not sent (${response.status}). The record is saved; please resend.`);}
 return {sent:true};
}