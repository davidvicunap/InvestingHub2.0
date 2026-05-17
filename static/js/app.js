const API_BASE = 'https://investinghub.onrender.com';

const LOGO_DOMAINS = {
    AAPL:'apple.com',MSFT:'microsoft.com',GOOGL:'google.com',GOOG:'google.com',AMZN:'amazon.com',META:'meta.com',
    TSLA:'tesla.com',NVDA:'nvidia.com',NFLX:'netflix.com',DIS:'disney.com',PYPL:'paypal.com',INTC:'intel.com',
    AMD:'amd.com',CRM:'salesforce.com',ORCL:'oracle.com',IBM:'ibm.com',CSCO:'cisco.com',ADBE:'adobe.com',
    SHOP:'shopify.com',SQ:'squareup.com',SPOT:'spotify.com',UBER:'uber.com',SNAP:'snap.com',ZM:'zoom.us',
    WMT:'walmart.com',TGT:'target.com',HD:'homedepot.com',COST:'costco.com',SBUX:'starbucks.com',
    MCD:'mcdonalds.com',NKE:'nike.com',KO:'coca-cola.com',PEP:'pepsico.com',JNJ:'jnj.com',PFE:'pfizer.com',
    V:'visa.com',MA:'mastercard.com',JPM:'jpmorganchase.com',BAC:'bankofamerica.com',GS:'goldmansachs.com',
    BA:'boeing.com',XOM:'exxonmobil.com',CVX:'chevron.com',F:'ford.com',GM:'gm.com',COIN:'coinbase.com',
    PLTR:'palantir.com',SNOW:'snowflake.com',CRWD:'crowdstrike.com',NET:'cloudflare.com',ABNB:'airbnb.com',
    ARM:'arm.com',AVGO:'broadcom.com',QCOM:'qualcomm.com',RIVN:'rivian.com',SOFI:'sofi.com',
    MRNA:'modernatx.com',UNH:'unitedhealthgroup.com',WFC:'wellsfargo.com',MS:'morganstanley.com',
    HOOD:'robinhood.com',DDOG:'datadoghq.com',MDB:'mongodb.com',BKNG:'booking.com',LOW:'lowes.com',
};

function app() {
    return {
        currentPage:'dashboard', searchQuery:'', searchResults:[], showSearchDropdown:false,
        darkMode: localStorage.getItem('investorhub-theme') !== 'light',
        connectionError:false, retrying:false,

        authToken: localStorage.getItem('investorhub-token')||'',
        currentUser: JSON.parse(localStorage.getItem('investorhub-user')||'null'),
        authPage:'login',
        showLoginModal:false, showRegisterModal:false, authError:'', authLoading:false,
        loginForm:{email:'',password:''}, registerForm:{name:'',email:'',password:''},

        navItems: [
            {id:'dashboard',label:'Dashboard',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>'},
            {id:'news',label:'News',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>'},
            {id:'analysis',label:'Analysis',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'},
            {id:'compare',label:'Compare',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>'},
            {id:'tables',label:'Tables',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>'},
            {id:'portfolio',label:'Portfolio',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'},
            {id:'calendar',label:'Calendar',icon:'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>'},
        ],

        marketData:[], marketLoading:false,
        watchlist:[], watchlistLoading:false,
        marketNews:[], newsLoading:false,
        portfolio:[], portfolioLoading:false,
        showAddHolding:false, newHolding:{symbol:'',shares:'',buy_price:'',buy_date:'',notes:''},
        showEditHolding:false, editingHolding:{id:null,symbol:'',shares:'',buy_price:'',buy_date:'',notes:''},
        portfolioReview:null, portfolioReviewLoading:false, showPortfolioReview:false,

        analysisSymbol:'', analysisData:null, analysisStats:[], analysisLoading:false,
        analysisTab:'Chart', analysisTabs:['Chart','Technicals','Fundamentals','Financials','News','SEC Filings','Profile'],
        chartPeriod:'1y', techPeriod:'1y',
        fundamentalsData:null, finTab:'income', finPeriod:'annual',
        stockScore:null, stockNews:null, stockNewsLoading:false,
        secFilings:null, secFilingsLoading:false,
        scoreCategories:[
            {key:'profitability',label:'Profitability',desc:'Margins & ROE',weight:25},
            {key:'growth',label:'Growth',desc:'Revenue & Earnings',weight:20},
            {key:'valuation',label:'Valuation',desc:'P/E, P/B & PEG',weight:20},
            {key:'financialHealth',label:'Financial Health',desc:'Debt & Liquidity',weight:20},
            {key:'momentum',label:'Momentum',desc:'Price Trends',weight:15},
        ],

        tvWidget:null, tvScreener:null,
        chatOpen:false, chatMessages:[], chatInput:'', chatLoading:false,

        calendarEvents:[], calendarLoading:false, calendarFilter:'all',
        dividendDetail:null, dividendDetailLoading:false, showDividendDetail:false,

        compareInput:'', compareData:null, compareLoading:false, comparePeriod:'1y',
        cmpColors:['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4'],
        compareMetrics:[
            {key:'price',label:'Price',format:'price'},{key:'marketCap',label:'Market Cap',format:'mcap'},
            {key:'peRatio',label:'P/E',format:'num'},{key:'forwardPE',label:'Fwd P/E',format:'num'},
            {key:'eps',label:'EPS',format:'price'},{key:'dividendYield',label:'Div Yield',format:'pct',colorize:true},
            {key:'beta',label:'Beta',format:'num'},{key:'profitMargin',label:'Profit Margin',format:'pct',colorize:true},
            {key:'returnOnEquity',label:'ROE',format:'pct',colorize:true},
            {key:'revenueGrowth',label:'Rev Growth',format:'pct',colorize:true},
            {key:'earningsGrowth',label:'Earn Growth',format:'pct',colorize:true},
            {key:'debtToEquity',label:'D/E',format:'num'},
            {key:'sector',label:'Sector',format:'txt'},{key:'industry',label:'Industry',format:'txt'},
        ],

        apex:{}, tv:{},

        init() {
            this.applyTheme();
            if(this.authToken){
                this.loadMarketData(); this.loadWatchlist(); this.loadPortfolio();
            }
            this._waitForLibs();
        },
        _chartsReady:false,
        _waitForLibs(){
            if(typeof LightweightCharts!=='undefined'&&typeof ApexCharts!=='undefined'){this._chartsReady=true;return}
            setTimeout(()=>this._waitForLibs(),100);
        },

        // ── Auth ──
        authH() { return this.authToken ? {'Authorization':`Bearer ${this.authToken}`} : {} },
        async login() {
            this.authError=''; this.authLoading=true;
            try {
                const r=await fetch(API_BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.loginForm)});
                const d=await r.json();
                if(!r.ok){this.authError=d.error||'Failed';this.authLoading=false;return}
                this.authToken=d.token;this.currentUser=d.user;
                localStorage.setItem('investorhub-token',d.token);localStorage.setItem('investorhub-user',JSON.stringify(d.user));
                this.showLoginModal=false;this.loginForm={email:'',password:''};
                this.loadMarketData();this.loadPortfolio();this.loadWatchlist();
            } catch(e){this.authError='Connection error'}
            this.authLoading=false;
        },
        async register() {
            this.authError=''; this.authLoading=true;
            try {
                const r=await fetch(API_BASE+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.registerForm)});
                const d=await r.json();
                if(!r.ok){this.authError=d.error||'Failed';this.authLoading=false;return}
                this.authToken=d.token;this.currentUser=d.user;
                localStorage.setItem('investorhub-token',d.token);localStorage.setItem('investorhub-user',JSON.stringify(d.user));
                this.showRegisterModal=false;this.registerForm={name:'',email:'',password:''};
                this.loadMarketData();this.loadPortfolio();this.loadWatchlist();
            } catch(e){this.authError='Connection error'}
            this.authLoading=false;
        },
        logout() {
            this.authToken='';this.currentUser=null;localStorage.removeItem('investorhub-token');localStorage.removeItem('investorhub-user');
            this.portfolio=[];this.watchlist=[];this.marketData=[];this.currentPage='dashboard';
        },

        // ── Theme ──
        toggleTheme(){this.darkMode=!this.darkMode;this.applyTheme();localStorage.setItem('investorhub-theme',this.darkMode?'dark':'light');this.reRender()},
        applyTheme(){document.documentElement.classList.toggle('dark',this.darkMode)},
        tc(){return this.darkMode?{bg:'#0f1729',grid:'#1e293b',text:'#94a3b8',cross:'#475569',border:'#334155',up:'#10b981',dn:'#ef4444',vUp:'rgba(16,185,129,.25)',vDn:'rgba(239,68,68,.25)',line:'#e2e8f0',am:'dark',ag:'#1e293b',at:'#94a3b8'}:{bg:'#fff',grid:'#f1f5f9',text:'#64748b',cross:'#94a3b8',border:'#e2e8f0',up:'#10b981',dn:'#ef4444',vUp:'rgba(16,185,129,.3)',vDn:'rgba(239,68,68,.3)',line:'#334155',am:'light',ag:'#f1f5f9',at:'#64748b'}},
        reRender(){if(this.currentPage==='analysis'&&this.analysisData){if(this.analysisTab==='Chart')this.loadPriceChart();if(this.analysisTab==='Technicals')this.loadTech();if(this.analysisTab==='Fundamentals'&&this.fundamentalsData)this.renderFundCharts()}if(this.currentPage==='compare'&&this.compareData)this.renderCmpChart();if(this.portfolio.length)this.renderPortCharts();if(this.currentPage==='tables')this.$nextTick(()=>this.initTvWidgets())},

        // ── Nav ──
        navigate(p){this.currentPage=p;if(p==='dashboard'){this.loadMarketData();this.loadWatchlist();this.loadPortfolio()}if(p==='news')this.loadMarketNews();if(p==='tables')this.$nextTick(()=>this.initTvWidgets());if(p==='portfolio')this.$nextTick(()=>{if(this.portfolio.length)this.renderPortCharts()});if(p==='calendar')this.loadCalendar()},
        selectStock(s){if(!s)return;this.analysisSymbol=s;this.currentPage='analysis';this.loadAnalysis(s)},
        switchTab(t){this.analysisTab=t;this.$nextTick(()=>{if(t==='Technicals')this.loadTech();if(t==='Fundamentals'&&this.fundamentalsData)this.renderFundCharts();if(t==='News'&&!this.stockNews)this.loadStockNews(this.analysisData?.symbol);if(t==='SEC Filings'&&!this.secFilings)this.loadSecFilings(this.analysisData?.symbol)})},

        // ── Helpers ──
        logoUrl(s){if(!s)return'';const c=s.replace('^','').replace('-USD','').replace('=F','').toUpperCase();const d=LOGO_DOMAINS[c];return `https://logo.clearbit.com/${d||c.toLowerCase()+'.com'}`},
        scoreColor(v){return v>=7?'#10b981':v>=5?'#f59e0b':'#ef4444'},
        fmtP(v){if(!v&&v!==0)return'—';return'$'+parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})},
        fmtBig(v){if(!v)return'—';const n=parseFloat(v);if(n>=1e12)return'$'+(n/1e12).toFixed(2)+'T';if(n>=1e9)return'$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(2)+'M';return'$'+n.toLocaleString()},
        fmtPct(v){if(!v&&v!==0)return'—';return(parseFloat(v)*100).toFixed(2)+'%'},
        fmtMetric(v,f){if(v==null)return'—';if(f==='price')return this.fmtP(v);if(f==='mcap')return this.fmtBig(v);if(f==='pct')return this.fmtPct(v);if(f==='rpct')return parseFloat(v).toFixed(2)+'%';if(f==='num')return parseFloat(v).toFixed(2);if(f==='txt')return v||'—';return v},
        metricColor(v){return(!v&&v!==0)?'fg-0':parseFloat(v)>=0?'text-emerald-500':'text-red-500'},
        timeAgo(ts){if(!ts)return'';const s=(Date.now()/1000-ts);if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';if(s<604800)return Math.floor(s/86400)+'d';return new Date(ts*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})},

        // ── API ──
        async api(u){
            try{
                const r=await fetch(API_BASE+u,{headers:this.authH()});
                if(r.status===401){this.logout();throw new Error('Session expired')}
                if(!r.ok)throw new Error(r.status);
                this.connectionError=false;
                return r.json();
            }catch(e){
                if(e.message==='Failed to fetch'||e.name==='TypeError')this.connectionError=true;
                throw e;
            }
        },
        async post(u,d){const r=await fetch(API_BASE+u,{method:'POST',headers:{'Content-Type':'application/json',...this.authH()},body:JSON.stringify(d)});return r.json()},
        async put(u,d){const r=await fetch(API_BASE+u,{method:'PUT',headers:{'Content-Type':'application/json',...this.authH()},body:JSON.stringify(d)});return r.json()},
        async del(u){await fetch(API_BASE+u,{method:'DELETE',headers:this.authH()})},
        async retryConnection(){this.retrying=true;try{await this.api('/');this.connectionError=false;this.init()}catch(e){}this.retrying=false},

        // ── Search ──
        _searchId:0,
        async searchStocks(){
            if(this.searchQuery.length<1){this.searchResults=[];this.showSearchDropdown=false;return}
            const id=++this._searchId;
            try{
                const r=await this.api(`/api/search?q=${encodeURIComponent(this.searchQuery)}`);
                if(id!==this._searchId)return;
                this.searchResults=Array.isArray(r)?r:[];
                this.showSearchDropdown=this.searchResults.length>0;
            }catch(e){if(id===this._searchId){this.searchResults=[];this.showSearchDropdown=false}}
        },

        // ── Market ──
        async loadMarketData(){this.marketLoading=true;try{this.marketData=await this.api('/api/market')}catch(e){}this.marketLoading=false},
        async loadMarketNews(){this.newsLoading=true;try{const d=await this.api('/api/market-news');this.marketNews=d.news||[]}catch(e){}this.newsLoading=false},
        async loadStockNews(s){if(!s)return;this.stockNewsLoading=true;try{this.stockNews=await this.api(`/api/news/${s}`)}catch(e){}this.stockNewsLoading=false},
        edgarUrl(sym,form){return`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(sym)}&type=${encodeURIComponent(form)}&dateb=&owner=include&count=10&search_text=&action=getcompany`},
        async loadSecFilings(s){
            if(!s)return;this.secFilingsLoading=true;
            try{this.secFilings=await this.api(`/api/sec-filings/${s}`)}catch(e){
                this.secFilings={symbol:s,filings:[],fallback:true,edgarUrl:this.edgarUrl(s,'')};
            }
            this.secFilingsLoading=false;
        },

        // ── Watchlist ──
        async loadWatchlist(){this.watchlistLoading=true;try{this.watchlist=await this.api('/api/watchlist')}catch(e){}this.watchlistLoading=false},
        async addToWatchlist(s){if(!s)return;await this.post('/api/watchlist',{symbol:s.toUpperCase()});this.loadWatchlist()},
        async removeFromWatchlist(s){await this.del(`/api/watchlist/${s}`);this.loadWatchlist()},

        // ── Portfolio ──
        async loadPortfolio(){this.portfolioLoading=true;try{this.portfolio=await this.api('/api/portfolio');if(this.currentPage==='dashboard'||this.currentPage==='portfolio')this.$nextTick(()=>{if(this.portfolio.length)this.renderPortCharts()})}catch(e){}this.portfolioLoading=false},
        async addHolding(){if(!this.newHolding.symbol||!this.newHolding.shares||!this.newHolding.buy_price)return;await this.post('/api/portfolio',this.newHolding);this.newHolding={symbol:'',shares:'',buy_price:'',buy_date:'',notes:''};this.showAddHolding=false;this.loadPortfolio()},
        async deleteHolding(id){await this.del(`/api/portfolio/${id}`);this.loadPortfolio()},
        openEditHolding(h){this.editingHolding={id:h.id,symbol:h.symbol,shares:h.shares,buy_price:h.buy_price,buy_date:h.buy_date||'',notes:h.notes||''};this.showEditHolding=true},
        async saveEditHolding(){if(!this.editingHolding.id)return;await this.put(`/api/portfolio/${this.editingHolding.id}`,{shares:parseFloat(this.editingHolding.shares),buy_price:parseFloat(this.editingHolding.buy_price),buy_date:this.editingHolding.buy_date,notes:this.editingHolding.notes});this.showEditHolding=false;this.loadPortfolio()},
        async analyzePortfolio(){
            if(!this.portfolio.length||this.portfolioReviewLoading)return;
            this.portfolioReviewLoading=true;this.showPortfolioReview=true;this.portfolioReview=null;
            const tv=this.ptv();
            const lines=this.portfolio.map(h=>{const v=(h.currentPrice||0)*h.shares;const pct=tv?(v/tv*100).toFixed(1):0;return`${h.symbol}: ${h.shares} shares @ $${h.buy_price} (now $${(h.currentPrice||0).toFixed(2)}), value $${v.toFixed(2)} (${pct}%), P&L $${this.hpl(h).toFixed(2)} (${this.hret(h).toFixed(1)}%)`});
            const ctx=[`Total Value: $${tv.toFixed(2)}`,`Total Cost: $${this.ptc().toFixed(2)}`,`Total P&L: $${this.ptp().toFixed(2)} (${this.ptr().toFixed(1)}%)`,`Holdings (${this.portfolio.length}):`,...lines].join('\n');
            try{const r=await this.post('/api/chat/portfolio',{portfolio_context:ctx});this.portfolioReview=r.reply||r.error||'Unable to generate analysis.'}catch(e){this.portfolioReview='Connection error. Please try again.'}
            this.portfolioReviewLoading=false;
        },
        hpl(h){return((h.currentPrice||0)-h.buy_price)*h.shares},
        hret(h){return h.buy_price?(((h.currentPrice||0)-h.buy_price)/h.buy_price)*100:0},
        ptv(){return this.portfolio.reduce((s,h)=>s+(h.currentPrice||0)*h.shares,0)},
        ptc(){return this.portfolio.reduce((s,h)=>s+h.buy_price*h.shares,0)},
        ptp(){return this.ptv()-this.ptc()},
        ptr(){const c=this.ptc();return c?((this.ptv()-c)/c)*100:0},

        renderPortCharts(){
            if(!this.portfolio.length)return;const c=this.tc();
            const lb=this.portfolio.map(h=>h.symbol),vl=this.portfolio.map(h=>Math.round((h.currentPrice||0)*h.shares*100)/100);
            const pie=(id,ht)=>({chart:{type:'donut',height:ht,background:'transparent'},series:vl,labels:lb,colors:['#6366f1','#06b6d4','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899'],theme:{mode:c.am},plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{color:c.at},value:{color:c.at,formatter:v=>'$'+parseFloat(v).toLocaleString()},total:{show:true,color:c.at,label:'Total',formatter:w=>'$'+w.globals.seriesTotals.reduce((a,b)=>a+b,0).toLocaleString()}}}}},legend:{position:'bottom',labels:{colors:c.at}},stroke:{colors:[c.bg]},dataLabels:{enabled:false}});
            if(document.getElementById('p-alloc'))this.renderApex('p-alloc',pie('a',260));
            if(document.getElementById('dash-pie'))this.renderApex('dash-pie',{...pie('d',190),plotOptions:{pie:{donut:{size:'70%'}}}});
            const pl=this.portfolio.map(h=>Math.round(this.hpl(h)*100)/100);
            if(document.getElementById('p-perf'))this.renderApex('p-perf',{chart:{type:'bar',height:260,background:'transparent',toolbar:{show:false}},series:[{name:'P&L',data:pl}],xaxis:{categories:lb,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toLocaleString()}},colors:pl.map(v=>v>=0?'#10b981':'#ef4444'),plotOptions:{bar:{distributed:true,borderRadius:5,columnWidth:'55%'}},theme:{mode:c.am},grid:{borderColor:c.ag,strokeDashArray:3},legend:{show:false},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+v.toLocaleString('en-US',{minimumFractionDigits:2})}}});
        },

        // ── Analysis ──
        async loadAnalysis(s){
            if(!s)return;s=s.toUpperCase().trim();this.analysisSymbol=s;this.analysisLoading=true;
            this.analysisData=null;this.analysisStats=[];this.fundamentalsData=null;this.stockScore=null;this.stockNews=null;this.secFilings=null;this.analysisTab='Chart';
            try{
                const d=await this.api(`/api/quote/${s}`);this.analysisData=d;
                this.analysisStats=[
                    {label:'Mkt Cap',value:this.fmtBig(d.marketCap)},{label:'P/E',value:d.peRatio?d.peRatio.toFixed(2):'—'},
                    {label:'Fwd P/E',value:d.forwardPE?d.forwardPE.toFixed(2):'—'},{label:'EPS',value:d.eps?'$'+d.eps.toFixed(2):'—'},
                    {label:'Div Yield',value:d.dividendYield?(d.dividendYield*100).toFixed(2)+'%':'—'},{label:'Beta',value:d.beta?d.beta.toFixed(2):'—'},
                    {label:'52W High',value:this.fmtP(d.fiftyTwoWeekHigh)},{label:'52W Low',value:this.fmtP(d.fiftyTwoWeekLow)},
                    {label:'Volume',value:d.volume?d.volume.toLocaleString():'—'},{label:'Avg Vol',value:d.avgVolume?d.avgVolume.toLocaleString():'—'},
                    {label:'Profit Margin',value:d.profitMargin?(d.profitMargin*100).toFixed(1)+'%':'—'},{label:'ROE',value:d.returnOnEquity?(d.returnOnEquity*100).toFixed(1)+'%':'—'},
                ];
                this.$nextTick(()=>this.loadPriceChart());
                this.api(`/api/fundamentals/${s}`).then(f=>this.fundamentalsData=f).catch(()=>{});
                this.api(`/api/score/${s}`).then(sc=>this.stockScore=sc).catch(()=>{});
            }catch(e){console.error(e)}
            this.analysisLoading=false;
        },

        // ── Financials ──
        _finData(){if(!this.fundamentalsData)return{};const m={'income-annual':'financials','income-quarterly':'quarterlyFinancials','balance-annual':'balanceSheet','balance-quarterly':'quarterlyBalanceSheet','cashflow-annual':'cashflow','cashflow-quarterly':'quarterlyCashflow'};return this.fundamentalsData[m[`${this.finTab}-${this.finPeriod}`]]||{}},
        finDates(){return Object.keys(this._finData()).sort().reverse()},
        _finOrder(){return{income:['#Revenue','*Total Revenue','Cost Of Revenue','*Gross Profit','#OpEx','Research And Development','Selling General And Administration','Operating Expense','*Operating Income','*EBIT','#Other','Interest Expense','Other Income Expense','#Pre-Tax','*Pretax Income','Tax Provision','#Net Income','*Net Income','*EBITDA','Reconciled Depreciation','#Per Share','Basic EPS','Diluted EPS','Basic Average Shares','Diluted Average Shares'],balance:['#Current Assets','Cash And Cash Equivalents','Accounts Receivable','Inventory','*Current Assets','#Non-Current','Net PPE','Goodwill And Other Intangible Assets','*Total Non Current Assets','#Assets','*Total Assets','#Current Liab','Accounts Payable','Current Debt','*Current Liabilities','#Non-Current Liab','Long Term Debt','*Total Non Current Liabilities Net Minority Interest','#Liabilities','*Total Liabilities Net Minority Interest','#Equity','Common Stock','Retained Earnings','*Stockholders Equity','*Total Equity Gross Minority Interest','#Other','Net Debt','Total Debt','Working Capital','Share Issued'],cashflow:['#Operating','Net Income From Continuing Operations','Depreciation And Amortization','Stock Based Compensation','Change In Working Capital','*Operating Cash Flow','#Investing','Capital Expenditure','*Investing Cash Flow','#Financing','Net Common Stock Issuance','Cash Dividends Paid','*Financing Cash Flow','#Net','Changes In Cash','*Free Cash Flow']}},
        finRows(){const d=this._finData(),dates=this.finDates();if(!dates.length)return[];const av=new Set();for(const dt of dates)for(const k of Object.keys(d[dt]||{}))av.add(k);const order=this._finOrder()[this.finTab]||[],used=new Set(),res=[];let hdr=null;for(const e of order){if(e[0]==='#'){hdr=e.slice(1);continue}const b=e[0]==='*',k=b?e.slice(1):e;if(av.has(k)){if(hdr){res.push({id:'h_'+hdr,type:'header',label:hdr});hdr=null}res.push({id:'i_'+k,type:'item',key:k,label:k,bold:b});used.add(k)}}const rem=[...av].filter(k=>!used.has(k)).sort();if(rem.length){res.push({id:'h_other',type:'header',label:'Other'});for(const k of rem)res.push({id:'i_'+k,type:'item',key:k,label:k,bold:false})}return res},
        finVal(k,d){return this._finData()[d]?.[k]??null},
        fmtFin(v,li){if(v==null)return'—';const n=parseFloat(v);if(isNaN(n))return'—';if(li&&(li.includes('EPS')||li.includes('Per Share')))return n<0?`(${Math.abs(n).toFixed(2)})`:n.toFixed(2);if(Math.abs(n)>=1e6){const m=Math.round(n/1e6);return m<0?`(${Math.abs(m).toLocaleString()})`:m.toLocaleString()}return n<0?`(${Math.abs(n).toFixed(2)})`:n.toFixed(2)},
        fmtFinDate(s){return new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})},

        // ── Charts ──
        mkTv(id,h){if(typeof LightweightCharts==='undefined')return null;this.rmTv(id);const el=document.getElementById(id);if(!el)return null;el.innerHTML='';const c=this.tc();const ch=LightweightCharts.createChart(el,{width:el.clientWidth,height:h||380,layout:{background:{type:'solid',color:c.bg},textColor:c.text,fontFamily:'Inter,system-ui,sans-serif',fontSize:12},grid:{vertLines:{color:c.grid},horzLines:{color:c.grid}},crosshair:{mode:LightweightCharts.CrosshairMode.Normal},rightPriceScale:{borderColor:c.border},timeScale:{borderColor:c.border,timeVisible:false}});const ro=new ResizeObserver(e=>{for(const en of e)ch.applyOptions({width:en.contentRect.width})});ro.observe(el);this.tv[id]={chart:ch,ro};return ch},
        rmTv(id){const e=this.tv[id];if(e){e.ro.disconnect();e.chart.remove();delete this.tv[id]}},

        async loadPriceChart(){
            const s=this.analysisData?.symbol;if(!s)return;
            try{const d=await this.api(`/api/history/${s}?period=${this.chartPeriod}`);if(!d||d.error)return;const c=this.tc(),ch=this.mkTv('tv-price',400);if(!ch)return;
            ch.addCandlestickSeries({upColor:c.up,downColor:c.dn,borderUpColor:c.up,borderDownColor:c.dn,wickUpColor:c.up,wickDownColor:c.dn}).setData(d.map(r=>({time:r.date,open:r.open,high:r.high,low:r.low,close:r.close})));
            const v=ch.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'v'});ch.priceScale('v').applyOptions({scaleMargins:{top:.82,bottom:0}});v.setData(d.map(r=>({time:r.date,value:r.volume,color:r.close>=r.open?c.vUp:c.vDn})));ch.timeScale().fitContent()}catch(e){}
        },

        async loadTech(){
            const s=this.analysisData?.symbol;if(!s)return;
            try{const d=await this.api(`/api/technicals/${s}?period=${this.techPeriod}`);if(!d||d.error)return;const c=this.tc();
            const ma=this.mkTv('tv-ma',340);if(ma){ma.addLineSeries({color:c.line,lineWidth:2}).setData(d.filter(r=>r.Close!=null).map(r=>({time:r.date,value:r.Close})));ma.addLineSeries({color:'#6366f1',lineWidth:1.5}).setData(d.filter(r=>r.SMA20!=null).map(r=>({time:r.date,value:r.SMA20})));ma.addLineSeries({color:'#f59e0b',lineWidth:1.5}).setData(d.filter(r=>r.SMA50!=null).map(r=>({time:r.date,value:r.SMA50})));ma.addLineSeries({color:'#06b6d4',lineWidth:1,lineStyle:2}).setData(d.filter(r=>r.BB_Upper!=null).map(r=>({time:r.date,value:r.BB_Upper})));ma.addLineSeries({color:'#06b6d4',lineWidth:1,lineStyle:2}).setData(d.filter(r=>r.BB_Lower!=null).map(r=>({time:r.date,value:r.BB_Lower})));ma.timeScale().fitContent()}
            const rsi=this.mkTv('tv-rsi',200);if(rsi){const rl=rsi.addLineSeries({color:'#8b5cf6',lineWidth:2,priceFormat:{type:'custom',formatter:v=>v.toFixed(1)}});rl.setData(d.filter(r=>r.RSI!=null).map(r=>({time:r.date,value:r.RSI})));rl.createPriceLine({price:70,color:'#ef4444',lineWidth:1,lineStyle:2,axisLabelVisible:true});rl.createPriceLine({price:30,color:'#10b981',lineWidth:1,lineStyle:2,axisLabelVisible:true});rsi.timeScale().fitContent()}
            const mc=this.mkTv('tv-macd',200);if(mc){mc.addLineSeries({color:'#6366f1',lineWidth:2}).setData(d.filter(r=>r.MACD!=null).map(r=>({time:r.date,value:r.MACD})));mc.addLineSeries({color:'#f59e0b',lineWidth:1.5}).setData(d.filter(r=>r.Signal!=null).map(r=>({time:r.date,value:r.Signal})));mc.addHistogramSeries({priceFormat:{type:'custom',formatter:v=>v.toFixed(3)}}).setData(d.filter(r=>r.MACD_Hist!=null).map(r=>({time:r.date,value:r.MACD_Hist,color:r.MACD_Hist>=0?'rgba(16,185,129,.6)':'rgba(239,68,68,.6)'})));mc.timeScale().fitContent()}}catch(e){}
        },

        renderFundCharts(){
            if(!this.fundamentalsData)return;const fd=this.fundamentalsData,c=this.tc();
            const fk=Object.keys(fd.financials||{}).sort(),yr=fk.map(d=>d.substring(0,4));
            const rev=fk.map(d=>{const v=fd.financials[d]?.['Total Revenue'];return v?Math.round(v/1e6):0});
            const ni=fk.map(d=>{const v=fd.financials[d]?.['Net Income'];return v?Math.round(v/1e6):0});
            this.renderApex('f-rev',{chart:{type:'bar',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Revenue ($M)',data:rev},{name:'Net Income ($M)',data:ni}],xaxis:{categories:yr,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toLocaleString()+'M'}},colors:['#6366f1','#10b981'],plotOptions:{bar:{borderRadius:5,columnWidth:'50%'}},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+v?.toLocaleString()+'M'}}});
            const gm=fk.map(d=>{const g=fd.financials[d]?.['Gross Profit'],r=fd.financials[d]?.['Total Revenue'];return g&&r?Math.round(g/r*1e4)/100:0});
            const om=fk.map(d=>{const o=fd.financials[d]?.['Operating Income'],r=fd.financials[d]?.['Total Revenue'];return o&&r?Math.round(o/r*1e4)/100:0});
            const nm=fk.map(d=>{const n=fd.financials[d]?.['Net Income'],r=fd.financials[d]?.['Total Revenue'];return n&&r?Math.round(n/r*1e4)/100:0});
            this.renderApex('f-margin',{chart:{type:'line',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Gross',data:gm},{name:'Operating',data:om},{name:'Net',data:nm}],xaxis:{categories:yr,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>v.toFixed(1)+'%'}},colors:['#6366f1','#f59e0b','#10b981'],stroke:{width:2.5,curve:'smooth'},markers:{size:4},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},tooltip:{theme:c.am,y:{formatter:v=>v?.toFixed(2)+'%'}}});
            const ck=Object.keys(fd.cashflow||{}).sort(),cy=ck.map(d=>d.substring(0,4));
            const ocf=ck.map(d=>{const v=fd.cashflow[d]?.['Operating Cash Flow'];return v?Math.round(v/1e6):0});
            const cap=ck.map(d=>{const v=fd.cashflow[d]?.['Capital Expenditure'];return v?Math.round(v/1e6):0});
            const fcf=ck.map((d,i)=>ocf[i]+cap[i]);
            this.renderApex('f-cf',{chart:{type:'bar',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Op CF ($M)',data:ocf},{name:'CapEx ($M)',data:cap},{name:'FCF ($M)',data:fcf}],xaxis:{categories:cy,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toLocaleString()+'M'}},colors:['#6366f1','#ef4444','#10b981'],plotOptions:{bar:{borderRadius:5,columnWidth:'50%'}},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+v?.toLocaleString()+'M'}}});
        },

        // ── Compare ──
        async loadCompare(){if(!this.compareInput)return;this.compareLoading=true;try{this.compareData=await this.api(`/api/compare?symbols=${this.compareInput.toUpperCase().replace(/\s/g,'')}&period=${this.comparePeriod}`);this.$nextTick(()=>this.renderCmpChart())}catch(e){}this.compareLoading=false},
        renderCmpChart(){if(!this.compareData)return;const ch=this.mkTv('tv-cmp',380);if(!ch)return;Object.keys(this.compareData).forEach((s,i)=>{const p=this.compareData[s]?.prices||[];if(!p.length)return;ch.addLineSeries({color:this.cmpColors[i%5],lineWidth:2,title:s,priceFormat:{type:'custom',formatter:v=>v.toFixed(1)}}).setData(p.map(r=>({time:r.date,value:r.normalized})))});ch.timeScale().fitContent()},

        // ── Apex ──
        renderApex(id,opts){if(typeof ApexCharts==='undefined')return;if(this.apex[id]){this.apex[id].destroy();delete this.apex[id]}const el=document.getElementById(id);if(!el)return;el.innerHTML='';const ch=new ApexCharts(el,opts);ch.render();this.apex[id]=ch},

        // ── Tables / TradingView ──
        initTvWidgets(){
            const theme=this.darkMode?'dark':'light';
            const chartEl=document.getElementById('tv-advanced-chart');
            if(chartEl){
                chartEl.innerHTML='';
                if(typeof TradingView!=='undefined'){
                    this.tvWidget=new TradingView.widget({
                        autosize:true,symbol:'NASDAQ:AAPL',interval:'D',timezone:'America/New_York',
                        theme:theme,style:'1',locale:'en',
                        enable_publishing:false,allow_symbol_change:true,
                        details:true,hotlist:true,calendar:true,
                        studies:['MASimple@tv-basicstudies','RSI@tv-basicstudies','MACD@tv-basicstudies'],
                        container_id:'tv-advanced-chart',
                        hide_side_toolbar:false,
                        withdateranges:true,
                        save_image:true,
                    });
                }
            }
            const scrEl=document.getElementById('tv-screener');
            if(scrEl){
                scrEl.innerHTML='';
                const s=document.createElement('script');
                s.type='text/javascript';
                s.src='https://s3.tradingview.com/external-embedding/embed-widget-screener.js';
                s.async=true;
                s.textContent=JSON.stringify({
                    width:'100%',height:500,defaultColumn:'overview',
                    defaultScreen:'most_capitalized',market:'america',
                    showToolbar:true,colorTheme:theme,locale:'en',
                });
                const wrap=document.createElement('div');
                wrap.className='tradingview-widget-container__widget';
                scrEl.appendChild(wrap);
                scrEl.appendChild(s);
            }
        },

        // ── Calendar ──
        async loadCalendar(){this.calendarLoading=true;try{const d=await this.api('/api/earnings-calendar');this.calendarEvents=d.events||[]}catch(e){this.calendarEvents=[]}this.calendarLoading=false},
        filteredCalendarEvents(){if(this.calendarFilter==='all')return this.calendarEvents;return this.calendarEvents.filter(e=>e.type===this.calendarFilter)},
        async loadDividendDetail(symbol){this.dividendDetailLoading=true;this.showDividendDetail=true;this.dividendDetail=null;try{this.dividendDetail=await this.api(`/api/dividends/${symbol}`)}catch(e){}this.dividendDetailLoading=false},
        calendarDateLabel(ds){const d=new Date(ds+'T00:00:00'),t=new Date();t.setHours(0,0,0,0);const diff=Math.ceil((d-t)/86400000);if(diff===0)return'Today';if(diff===1)return'Tomorrow';if(diff<=7)return d.toLocaleDateString('en-US',{weekday:'short'});return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})},

        // ── AI Chat ──
        toggleChat(){this.chatOpen=!this.chatOpen;if(this.chatOpen)this.$nextTick(()=>{const el=document.getElementById('chat-input');if(el)el.focus()})},
        async sendChat(){
            const msg=this.chatInput.trim();if(!msg||this.chatLoading)return;
            this.chatMessages.push({role:'user',content:msg});this.chatInput='';this.chatLoading=true;
            this.$nextTick(()=>this.scrollChat());
            try{
                const r=await fetch(API_BASE+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:this.chatMessages})});
                const d=await r.json();
                if(d.reply){this.chatMessages.push({role:'assistant',content:d.reply})}
                else{this.chatMessages.push({role:'assistant',content:'Sorry, I couldn\'t process that. Please try again.'})}
            }catch(e){this.chatMessages.push({role:'assistant',content:'Connection error. Please try again.'})}
            this.chatLoading=false;this.$nextTick(()=>this.scrollChat());
        },
        scrollChat(){const el=document.getElementById('chat-body');if(el)el.scrollTop=el.scrollHeight},
        fmtChat(text){
            if(!text)return'';
            return text
                .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
                .replace(/\*(.+?)\*/g,'<em>$1</em>')
                .replace(/`(.+?)`/g,'<code class="text-brand-400 bg-[var(--bg-2)] px-1 rounded text-[12px]">$1</code>')
                .replace(/\n/g,'<br>');
        },
    };
}
