const html=await(await fetch('https://psmsl.org/data/obtaining/complete.php')).text();
console.log([...html.matchAll(/href=["']([^"']+)["']/g)].map(m=>m[1]).filter(s=>/zip|policy|terms|licen/i.test(s)));
for(const url of ['https://psmsl.org/data/obtaining/rlr.annual.data/filelist.txt','https://psmsl.org/data/obtaining/rlr.annual.data/134.rlrdata']){
 const r=await fetch(url);console.log(url,r.status,(await r.text()).slice(0,1500));
}
