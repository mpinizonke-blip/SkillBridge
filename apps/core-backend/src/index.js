'use strict';
require('dotenv').config();
const express=require('express'), cors=require('cors'), jwt=require('jsonwebtoken'), bcrypt=require('bcryptjs');
const {Sequelize,DataTypes}=require('sequelize');
if (!process.env.DB_PASSWORD || !process.env.JWT_SECRET) {
  console.error('Set DB_PASSWORD and JWT_SECRET in .env');
  process.exit(1);
}
const db = new Sequelize(
  process.env.DB_NAME || 'skillbridge_sa',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: false
  }
);
const User=db.define('User',{name:{type:DataTypes.STRING,allowNull:false},email:{type:DataTypes.STRING,allowNull:false,unique:true},passwordHash:{type:DataTypes.STRING,allowNull:false},role:{type:DataTypes.ENUM('SEEKER','EMPLOYER','ADMIN'),allowNull:false},skills:{type:DataTypes.TEXT,defaultValue:''}});
const Job=db.define('Job',{title:{type:DataTypes.STRING,allowNull:false},company:{type:DataTypes.STRING,allowNull:false},location:{type:DataTypes.STRING,allowNull:false},type:{type:DataTypes.STRING,allowNull:false},description:{type:DataTypes.TEXT,allowNull:false},skills:{type:DataTypes.STRING,defaultValue:''},status:{type:DataTypes.ENUM('PENDING','APPROVED','REJECTED'),defaultValue:'PENDING'}});
const Application=db.define('Application',{status:{type:DataTypes.ENUM('APPLIED','SHORTLISTED','ACCEPTED','DECLINED'),defaultValue:'APPLIED'}});
User.hasMany(Job,{foreignKey:'employerId'});Job.belongsTo(User,{as:'employer',foreignKey:'employerId'});
User.hasMany(Application,{foreignKey:'seekerId'});Application.belongsTo(User,{as:'seeker',foreignKey:'seekerId'});
Job.hasMany(Application,{foreignKey:'jobId'});Application.belongsTo(Job,{foreignKey:'jobId'});
const app=express();app.use(cors({origin:process.env.FRONTEND_URL||'http://localhost:3000'}));app.use(express.json({limit:'30kb'}));
const secret=process.env.JWT_SECRET;
const wrap=fn=>(req,res)=>Promise.resolve(fn(req,res)).catch(e=>{console.error(e);res.status(500).json({error:'Server error'})});
function auth(req,res,next){try{const token=(req.headers.authorization||'').replace(/^Bearer /,'');req.user=jwt.verify(token,secret);next()}catch{res.status(401).json({error:'Please log in'})}}
const permit=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Not permitted'});
const clean=s=>String(s||'').trim();
app.get('/health',(_req,res)=>res.json({ok:true}));
app.post('/api/auth/login',wrap(async(req,res)=>{const user=await User.findOne({where:{email:clean(req.body.email).toLowerCase()}});if(!user||!await bcrypt.compare(String(req.body.password||''),user.passwordHash))return res.status(401).json({error:'Invalid credentials'});const token=jwt.sign({id:user.id,role:user.role},secret,{expiresIn:'8h'});res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role,skills:user.skills}})}));
app.get('/api/jobs',auth,wrap(async(req,res)=>{const where=req.user.role==='ADMIN'?{}:req.user.role==='EMPLOYER'?{employerId:req.user.id}:{status:'APPROVED'};const jobs=await Job.findAll({where,order:[['createdAt','DESC']]});res.json(jobs)}));
app.post('/api/jobs',auth,permit('EMPLOYER'),wrap(async(req,res)=>{const {title,company,location,type,description,skills}=req.body;if([title,company,location,type,description].some(x=>!clean(x)))return res.status(400).json({error:'Complete all required fields'});const job=await Job.create({title:clean(title),company:clean(company),location:clean(location),type:clean(type),description:clean(description),skills:clean(skills),employerId:req.user.id});res.status(201).json(job)}));
app.patch('/api/jobs/:id/verify',auth,permit('ADMIN'),wrap(async(req,res)=>{const job=await Job.findByPk(req.params.id);if(!job)return res.status(404).json({error:'Not found'});if(!['APPROVED','REJECTED'].includes(req.body.status))return res.status(400).json({error:'Invalid status'});job.status=req.body.status;await job.save();res.json(job)}));
app.post('/api/jobs/:id/apply',auth,permit('SEEKER'),wrap(async(req,res)=>{const job=await Job.findByPk(req.params.id);if(!job||job.status!=='APPROVED')return res.status(404).json({error:'Opportunity unavailable'});const [application,created]=await Application.findOrCreate({where:{jobId:job.id,seekerId:req.user.id},defaults:{status:'APPLIED'}});res.status(created?201:409).json(created?application:{error:'Already applied'})}));
app.get('/api/applications',auth,wrap(async(req,res)=>{let where={};if(req.user.role==='SEEKER')where={seekerId:req.user.id};if(req.user.role==='EMPLOYER'){const jobs=await Job.findAll({where:{employerId:req.user.id},attributes:['id']});where={jobId:jobs.map(j=>j.id)}}const applications=await Application.findAll({where,include:[{model:Job},{model:User,as:'seeker',attributes:['id','name','skills']}],order:[['createdAt','DESC']]});res.json(applications)}));
app.patch('/api/applications/:id',auth,permit('EMPLOYER'),wrap(async(req,res)=>{const a=await Application.findByPk(req.params.id,{include:[Job]});if(!a)return res.status(404).json({error:'Not found'});if(a.Job.employerId!==req.user.id)return res.status(403).json({error:'Not your opportunity'});if(!['SHORTLISTED','ACCEPTED','DECLINED'].includes(req.body.status))return res.status(400).json({error:'Invalid status'});a.status=req.body.status;await a.save();res.json(a)}));
app.get('/api/matches',auth,permit('SEEKER'),wrap(async(req,res)=>{const user=await User.findByPk(req.user.id);const own=new Set(clean(user.skills).toLowerCase().split(',').map(s=>s.trim()).filter(Boolean));const jobs=await Job.findAll({where:{status:'APPROVED'}});res.json(jobs.map(job=>{const required=clean(job.skills).toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);const overlap=required.filter(s=>own.has(s));return {job,score:required.length?Math.round(100*overlap.length/required.length):0,matchedSkills:overlap,requiredSkills:required}}).sort((a,b)=>b.score-a.score))}));
async function seed(){if(process.env.SEED_DEMO!=='true')return;const accounts=[['Demo Seeker','seeker@skillbridge.local','SEEKER','communication, excel, customer service'],['Demo Employer','employer@skillbridge.local','EMPLOYER',''],['Demo Admin','admin@skillbridge.local','ADMIN','']];const users=[];for(const [name,email,role,skills] of accounts){const [u]=await User.findOrCreate({where:{email},defaults:{name,role,skills,passwordHash:await bcrypt.hash(process.env.DEMO_PASSWORD||'ChangeMe123!',12)}});users.push(u)}if(await Job.count()===0){await Job.create({title:'Vacation Work Assistant',company:'Cape Community Hub',location:'Cape Town',type:'Vacation work',description:'Help with reception, records and customer support. Fictional demo opportunity.',skills:'communication, excel',status:'APPROVED',employerId:users[1].id});await Job.create({title:'Digital Skills Micro-Internship',company:'Youth Digital Studio',location:'Remote',type:'Micro-internship',description:'Support a small team with content and basic digital tasks. Fictional demo opportunity.',skills:'communication, design',status:'APPROVED',employerId:users[1].id})}}
(async()=>{await db.authenticate();await db.sync();await seed();app.listen(process.env.PORT||4001,()=>console.log('SkillBridge API ready'))})().catch(e => {
  console.error('Startup failed:', e);
  process.exit(1);
});