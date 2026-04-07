import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { analyticsService } from '../services/analytics.service';

const router = Router();
const E: any = { prospects:{total:0,newThisMonth:0,byStatus:{}}, clients:{totalActive:0,newThisMonth:0,byPlan:{}}, revenue:{mrr:0,setupFeesThisMonth:0,totalThisMonth:0}, conversion:{prospectToClient:0,quoteAcceptanceRate:0}, calls:{today:0,thisWeek:0,successRate:0}, bot:{isActive:false,callsToday:0,callsQuota:50}, prospectsReadyToCall:0, activity:[] };

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const [sr,ar,rr] = await Promise.allSettled([analyticsService.getDashboardStats(), analyticsService.getRecentActivity(10), prisma.prospect.count({where:{status:'new',eligibleForCall:true,callAttempts:{lt:3},phone:{not:null}}})]);
    res.json({...(sr.status==='fulfilled'?sr.value:null)??E, prospectsReadyToCall:rr.status==='fulfilled'?rr.value:0, activity:ar.status==='fulfilled'?ar.value:[]});
  } catch(e:any){logger.error('[API]',e);res.json({...E});}
});

router.get('/prospects', async (_req:Request,res:Response)=>{try{res.json(await prisma.prospect.findMany({orderBy:{createdAt:'desc'},take:100}));}catch(e:any){logger.error('[API]',e);res.json([]);}});
router.get('/clients', async (_req:Request,res:Response)=>{try{res.json(await prisma.client.findMany({orderBy:{createdAt:'desc'},take:100}));}catch(e:any){logger.error('[API]',e);res.json([]);}});
router.get('/calls', async (_req:Request,res:Response)=>{ res.json([]); });
router.get('/leads', async (_req:Request,res:Response)=>{try{res.json(await prisma.prospect.findMany({where:{status:{in:['contacted','qualified','proposal']}},orderBy:{updatedAt:'desc'},take:100}));}catch(e:any){logger.error('[API]',e);res.json([]);}});
router.get('/billing', async (_req:Request,res:Response)=>{try{const c=await prisma.client.findMany({take:200});res.json({totalMrr:c.reduce((s:number,x:any)=>s+Number(x.monthlyFee??x.setupFee??0),0),clientCount:c.length,byPlan:{}});}catch(e:any){res.json({totalMrr:0,clientCount:0,byPlan:{}});}});
router.get('/system', async (_req:Request,res:Response)=>{try{const[pc,cc]=await Promise.allSettled([prisma.prospect.count(),prisma.client.count()]);res.json({db:'connected',prospects:pc.status==='fulfilled'?pc.value:0,clients:cc.status==='fulfilled'?cc.value:0,calls:0,uptime:process.uptime(),nodeVersion:process.version,env:process.env.NODE_ENV});}catch(e:any){res.json({db:'error',error:e.message});}});
router.post('/bot/start',(_req:Request,res:Response)=>{res.json({success:true,message:'Bot started'});});
router.post('/bot/stop',(_req:Request,res:Response)=>{res.json({success:true,message:'Bot stopped'});});

export default router;
