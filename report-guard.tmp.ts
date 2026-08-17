import { buildReportSnapshot } from "@/lib/report-snapshot";
import { buildDeterministicReport } from "@/lib/report-engine";
import { buildReportPayload, checkReportNarration, deterministicNarration } from "@/lib/report-explain";
const now = new Date(2026,0,20);
const settings:any={salaryAmount:60000,salaryDay:1,enabled:true,payFrequency:"monthly"};
const cats=[{id:"c1",name:"Transport",type:"expense"},{id:"c2",name:"Food",type:"expense"}] as any[];
const tx=(id:string,a:number,d:number,c:string|null,t="expense")=>({id,user_id:"u",type:t,amount:a,category_id:c,subcategory:null,payment_method:"upi",notes:null,tags:[],transaction_date:`2026-01-${String(d).padStart(2,"0")}`,created_at:""}) as any;
const snap=buildReportSnapshot({transactions:[tx("1",12000,3,"c1"),tx("2",4000,5,"c2"),tx("3",1500,9,"c2"),tx("4",60000,1,null,"income")],categories:cats,budgets:[],loans:[],salarySettings:settings,goals:[],savedSoFar:null,period:"monthly",now});
const rep=buildDeterministicReport(snap);
if(!rep.available) throw new Error("expected available");
const p=buildReportPayload(rep,snap);
const cases:[string,string,boolean][]=[
 ["faithful", "Transport is 68% of your spending this period.", true],
 ["invented number","You will save ₹18,300 next month.",false],
 ["invented loan","Your EMI is eating your salary.",false],
 ["invented subscription","Cancel one subscription to save money.",false],
 ["invented goal","Your goal is on track.",false],
 ["invented investment","Your SIP is doing well.",false],
];
for(const [n,t,exp] of cases){const got=checkReportNarration(t,p);console.log((got===exp?"PASS":"FAIL"),n,"->",got);}
console.log("fallback source:",deterministicNarration(rep).source,"| highlights:",deterministicNarration(rep).highlights.length);
console.log("payload keys leaked?", JSON.stringify(p).match(/@|user_id|"id"/)?"YES":"no");
