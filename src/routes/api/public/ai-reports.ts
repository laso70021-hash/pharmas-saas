import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/ai-reports')({server:{handlers:{GET:async({request})=>{
 const secret=process.env['CRON_SECRET'];
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 const {processAIReports}=await import('@/lib/report-processor.server');
 try{return Response.json(await processAIReports());}catch(err){console.error('Report processor failed',err instanceof Error?err.message:'unknown');return new Response('Report processing failed',{status:500});}
}}}});