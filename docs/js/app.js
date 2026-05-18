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
        compareAiSummary:null, compareAiLoading:false, showCompareAi:false,
        cmpColors:['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4'],
        compareMetrics:[
            {key:'price',label:'Price',format:'price',hb:null},{key:'marketCap',label:'Market Cap',format:'mcap',hb:true},
            {key:'peRatio',label:'P/E',format:'num',hb:false},{key:'forwardPE',label:'Fwd P/E',format:'num',hb:false},
            {key:'eps',label:'EPS',format:'price',hb:true},{key:'dividendYield',label:'Div Yield',format:'pct',colorize:true,hb:true},
            {key:'beta',label:'Beta',format:'num',hb:null},{key:'profitMargin',label:'Profit Margin',format:'pct',colorize:true,hb:true},
            {key:'returnOnEquity',label:'ROE',format:'pct',colorize:true,hb:true},
            {key:'revenueGrowth',label:'Rev Growth',format:'pct',colorize:true,hb:true},
            {key:'earningsGrowth',label:'Earn Growth',format:'pct',colorize:true,hb:true},
            {key:'debtToEquity',label:'D/E',format:'num',hb:false},
            {key:'sector',label:'Sector',format:'txt',hb:null},{key:'industry',label:'Industry',format:'txt',hb:null},
        ],

        chartAiInsight:null, chartAiLoading:false,
        fundAiSummary:null, fundAiLoading:false,

        watchlistDigest:null, watchlistDigestLoading:false, showWatchlistDigest:false,
        peerData:null, peerLoading:false,
        optimizerResult:null, optimizerLoading:false, showOptimizer:false,
        earningsHistory:null, earningsHistoryLoading:false, earningsHistorySymbol:'',

        apex:{}, tv:{},
        _apiCache:{},
        _cacheTTLs:{'/api/market':60,'/api/market-news':180,'/api/watchlist':30,'/api/portfolio':30,'/api/earnings-calendar':120},
        _cachePrefixTTLs:[['/api/quote/',30],['/api/history/',60],['/api/technicals/',60],['/api/fundamentals/',300],['/api/score/',300],['/api/news/',120],['/api/sec-filings/',120],['/api/dividends/',300],['/api/compare?',60]],

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
            this.portfolio=[];this.watchlist=[];this.marketData=[];this.currentPage='dashboard';this.clearCache();
        },

        // ── Theme ──
        toggleTheme(){this.darkMode=!this.darkMode;this.applyTheme();localStorage.setItem('investorhub-theme',this.darkMode?'dark':'light');this.reRender()},
        applyTheme(){document.documentElement.classList.toggle('dark',this.darkMode)},
        tc(){return this.darkMode?{bg:'#0f1729',grid:'#1e293b',text:'#94a3b8',cross:'#475569',border:'#334155',up:'#10b981',dn:'#ef4444',vUp:'rgba(16,185,129,.25)',vDn:'rgba(239,68,68,.25)',line:'#e2e8f0',am:'dark',ag:'#1e293b',at:'#94a3b8'}:{bg:'#fff',grid:'#f1f5f9',text:'#64748b',cross:'#94a3b8',border:'#e2e8f0',up:'#10b981',dn:'#ef4444',vUp:'rgba(16,185,129,.3)',vDn:'rgba(239,68,68,.3)',line:'#334155',am:'light',ag:'#f1f5f9',at:'#64748b'}},
        reRender(){if(this.currentPage==='analysis'&&this.analysisData){if(this.analysisTab==='Chart')this.loadPriceChart();if(this.analysisTab==='Technicals')this.loadTech();if(this.analysisTab==='Fundamentals'&&this.fundamentalsData)this.renderFundCharts()}if(this.currentPage==='compare'&&this.compareData){this.renderCmpChart();this.renderCmpRadar()}if(this.portfolio.length)this.renderPortCharts();if(this.currentPage==='tables')this.$nextTick(()=>this.initTvWidgets());if(this.optimizerResult)this.$nextTick(()=>{this.renderEfficientFrontier();this.renderOptimalWeights()});if(this.earningsHistory)this.$nextTick(()=>this.renderEarningsChart())},

        // ── Nav ──
        navigate(p){this.currentPage=p;if(p==='dashboard'){this.loadMarketData();this.loadWatchlist();this.loadPortfolio()}if(p==='news')this.loadMarketNews();if(p==='tables')this.$nextTick(()=>this.initTvWidgets());if(p==='portfolio')this.$nextTick(()=>{if(this.portfolio.length)this.renderPortCharts()});if(p==='calendar')this.loadCalendar()},
        selectStock(s){if(!s)return;this.analysisSymbol=s;this.currentPage='analysis';this.loadAnalysis(s)},
        switchTab(t){this.analysisTab=t;this.$nextTick(()=>{if(t==='Technicals')this.loadTech();if(t==='Fundamentals'&&this.fundamentalsData)this.renderFundCharts();if(t==='News'&&!this.stockNews)this.loadStockNews(this.analysisData?.symbol);if(t==='SEC Filings'&&!this.secFilings)this.loadSecFilings(this.analysisData?.symbol)})},

        // ── Helpers ──
        _logoDomain(s){const c=s.replace('^','').replace('-USD','').replace('=F','').toUpperCase();return LOGO_DOMAINS[c]||c.toLowerCase()+'.com'},
        logoUrl(s){if(!s)return'';return`https://logo.clearbit.com/${this._logoDomain(s)}`},
        logoFallback(s){if(!s)return'';return`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${this._logoDomain(s)}&size=128`},
        scoreColor(v){return v>=7?'#10b981':v>=5?'#f59e0b':'#ef4444'},
        fmtP(v){if(!v&&v!==0)return'—';return'$'+parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})},
        fmtBig(v){if(!v)return'—';const n=parseFloat(v);if(n>=1e12)return'$'+(n/1e12).toFixed(2)+'T';if(n>=1e9)return'$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(2)+'M';return'$'+n.toLocaleString()},
        fmtPct(v){if(!v&&v!==0)return'—';return(parseFloat(v)*100).toFixed(2)+'%'},
        fmtMetric(v,f){if(v==null)return'—';if(f==='price')return this.fmtP(v);if(f==='mcap')return this.fmtBig(v);if(f==='pct')return this.fmtPct(v);if(f==='rpct')return parseFloat(v).toFixed(2)+'%';if(f==='num')return parseFloat(v).toFixed(2);if(f==='txt')return v||'—';return v},
        metricColor(v){return(!v&&v!==0)?'fg-0':parseFloat(v)>=0?'text-emerald-500':'text-red-500'},
        timeAgo(ts){if(!ts)return'';const s=(Date.now()/1000-ts);if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';if(s<604800)return Math.floor(s/86400)+'d';return new Date(ts*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})},

        // ── API ──
        _getCacheTTL(u){
            const exact=this._cacheTTLs[u];if(exact)return exact;
            for(const[p,t]of this._cachePrefixTTLs)if(u.startsWith(p))return t;
            return 0;
        },
        clearCache(pattern){if(!pattern){this._apiCache={};return}for(const k of Object.keys(this._apiCache))if(k.includes(pattern))delete this._apiCache[k]},
        async api(u,skipCache){
            const ttl=this._getCacheTTL(u);
            if(!skipCache&&ttl){const c=this._apiCache[u];if(c&&(Date.now()/1000-c.t)<ttl)return c.d}
            try{
                const r=await fetch(API_BASE+u,{headers:this.authH()});
                if(r.status===401){this.logout();throw new Error('Session expired')}
                if(!r.ok)throw new Error(r.status);
                this.connectionError=false;
                const data=await r.json();
                if(ttl){
                    const keys=Object.keys(this._apiCache);
                    if(keys.length>100){keys.sort((a,b)=>this._apiCache[a].t-this._apiCache[b].t);for(const k of keys.slice(0,50))delete this._apiCache[k]}
                    this._apiCache[u]={d:data,t:Date.now()/1000};
                }
                return data;
            }catch(e){
                if(e.message==='Failed to fetch'||e.name==='TypeError')this.connectionError=true;
                throw e;
            }
        },
        async post(u,d){const r=await fetch(API_BASE+u,{method:'POST',headers:{'Content-Type':'application/json',...this.authH()},body:JSON.stringify(d)});if(r.status===401){this.logout();throw new Error('Session expired')}return r.json()},
        async put(u,d){const r=await fetch(API_BASE+u,{method:'PUT',headers:{'Content-Type':'application/json',...this.authH()},body:JSON.stringify(d)});if(r.status===401){this.logout();throw new Error('Session expired')}return r.json()},
        async del(u){const r=await fetch(API_BASE+u,{method:'DELETE',headers:this.authH()});if(r.status===401){this.logout();throw new Error('Session expired')}},
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
        async addToWatchlist(s){if(!s)return;await this.post('/api/watchlist',{symbol:s.toUpperCase()});this.clearCache('/api/watchlist');this.loadWatchlist()},
        async removeFromWatchlist(s){await this.del(`/api/watchlist/${s}`);this.clearCache('/api/watchlist');this.loadWatchlist()},

        // ── Portfolio ──
        async loadPortfolio(){this.portfolioLoading=true;try{this.portfolio=await this.api('/api/portfolio');if(this.currentPage==='dashboard'||this.currentPage==='portfolio')this.$nextTick(()=>{if(this.portfolio.length)this.renderPortCharts()})}catch(e){}this.portfolioLoading=false},
        async addHolding(){if(!this.newHolding.symbol||!this.newHolding.shares||!this.newHolding.buy_price)return;await this.post('/api/portfolio',this.newHolding);this.newHolding={symbol:'',shares:'',buy_price:'',buy_date:'',notes:''};this.showAddHolding=false;this.clearCache('/api/portfolio');this.loadPortfolio()},
        async deleteHolding(id){await this.del(`/api/portfolio/${id}`);this.clearCache('/api/portfolio');this.loadPortfolio()},
        openEditHolding(h){this.editingHolding={id:h.id,symbol:h.symbol,shares:h.shares,buy_price:h.buy_price,buy_date:h.buy_date||'',notes:h.notes||''};this.showEditHolding=true},
        async saveEditHolding(){if(!this.editingHolding.id)return;await this.put(`/api/portfolio/${this.editingHolding.id}`,{shares:parseFloat(this.editingHolding.shares),buy_price:parseFloat(this.editingHolding.buy_price),buy_date:this.editingHolding.buy_date,notes:this.editingHolding.notes});this.showEditHolding=false;this.clearCache('/api/portfolio');this.loadPortfolio()},
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
            this.analysisData=null;this.analysisStats=[];this.fundamentalsData=null;this.stockScore=null;this.stockNews=null;this.secFilings=null;this.analysisTab='Chart';this.chartAiInsight=null;this.fundAiSummary=null;this.peerData=null;
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
                this.loadPeers(s);
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
        async loadCompare(){if(!this.compareInput)return;this.compareLoading=true;this.compareAiSummary=null;this.showCompareAi=false;try{this.compareData=await this.api(`/api/compare?symbols=${this.compareInput.toUpperCase().replace(/\s/g,'')}&period=${this.comparePeriod}`);this.$nextTick(()=>{this.renderCmpChart();this.renderCmpRadar()})}catch(e){}this.compareLoading=false},
        renderCmpChart(){if(!this.compareData)return;const ch=this.mkTv('tv-cmp',380);if(!ch)return;Object.keys(this.compareData).forEach((s,i)=>{const p=this.compareData[s]?.prices||[];if(!p.length)return;ch.addLineSeries({color:this.cmpColors[i%5],lineWidth:2,title:s,priceFormat:{type:'custom',formatter:v=>v.toFixed(1)}}).setData(p.map(r=>({time:r.date,value:r.normalized})))});ch.timeScale().fitContent()},
        renderCmpRadar(){
            if(!this.compareData)return;const c=this.tc(),syms=Object.keys(this.compareData);
            const axes=['P/E','Profit Margin','ROE','Rev Growth','D/E'];
            const keys=['peRatio','profitMargin','returnOnEquity','revenueGrowth','debtToEquity'];
            const invert=[true,false,false,false,true];
            const series=syms.map((s,i)=>{
                const vals=keys.map((k,j)=>{let v=parseFloat(this.compareData[s]?.[k])||0;if(k==='profitMargin'||k==='returnOnEquity'||k==='revenueGrowth')v=v*100;if(invert[j])v=v===0?5:Math.max(0,10-Math.abs(v)/5);else v=Math.min(10,Math.max(0,v/5+5));return Math.round(v*10)/10});
                return{name:s,data:vals};
            });
            this.renderApex('cmp-radar',{chart:{type:'radar',height:340,background:'transparent',toolbar:{show:false}},series,xaxis:{categories:axes,labels:{style:{colors:Array(5).fill(c.at),fontSize:'11px'}}},yaxis:{show:false,max:10},colors:this.cmpColors.slice(0,syms.length),stroke:{width:2},fill:{opacity:.15},markers:{size:3},theme:{mode:c.am},legend:{labels:{colors:c.at},position:'bottom'},plotOptions:{radar:{polygons:{strokeColors:c.ag,connectorColors:c.ag}}}});
        },
        cmpCellClass(s,mKey){
            if(!this.compareData)return'fg-0';const m=this.compareMetrics.find(x=>x.key===mKey);if(!m||m.hb===null||m.format==='txt')return'fg-0';
            const syms=Object.keys(this.compareData),vals=syms.map(sym=>parseFloat(this.compareData[sym]?.[mKey])||0);
            const v=parseFloat(this.compareData[s]?.[mKey])||0;const mx=Math.max(...vals),mn=Math.min(...vals);
            if(vals.every(x=>x===v))return'fg-0';
            if(m.hb){return v===mx?'text-emerald-500 font-bold':v===mn?'text-red-400':'fg-0'}
            return v===mn?'text-emerald-500 font-bold':v===mx?'text-red-400':'fg-0';
        },
        async analyzeComparison(){
            if(!this.compareData||this.compareAiLoading)return;
            this.compareAiLoading=true;this.showCompareAi=true;this.compareAiSummary=null;
            const syms=Object.keys(this.compareData);
            const lines=syms.map(s=>{const d=this.compareData[s];return`${s}: Price $${d.price?.toFixed(2)}, MCap ${this.fmtBig(d.marketCap)}, P/E ${d.peRatio?.toFixed(1)||'N/A'}, Fwd P/E ${d.forwardPE?.toFixed(1)||'N/A'}, EPS $${d.eps?.toFixed(2)||'N/A'}, Div Yield ${d.dividendYield?(d.dividendYield*100).toFixed(2)+'%':'N/A'}, Beta ${d.beta?.toFixed(2)||'N/A'}, Profit Margin ${d.profitMargin?(d.profitMargin*100).toFixed(1)+'%':'N/A'}, ROE ${d.returnOnEquity?(d.returnOnEquity*100).toFixed(1)+'%':'N/A'}, Rev Growth ${d.revenueGrowth?(d.revenueGrowth*100).toFixed(1)+'%':'N/A'}, Earn Growth ${d.earningsGrowth?(d.earningsGrowth*100).toFixed(1)+'%':'N/A'}, D/E ${d.debtToEquity?.toFixed(1)||'N/A'}, Sector: ${d.sector||'N/A'}`});
            const ctx=`Compare these stocks side by side:\n\n${lines.join('\n')}`;
            try{const r=await this.post('/api/chat/compare',{comparison_context:ctx});this.compareAiSummary=r.reply||r.error||'Unable to generate analysis.'}catch(e){this.compareAiSummary='Connection error. Please try again.'}
            this.compareAiLoading=false;
        },
        async getChartInsight(){
            if(!this.analysisData||this.chartAiLoading)return;
            this.chartAiLoading=true;this.chartAiInsight=null;
            const s=this.analysisData.symbol;
            try{
                const t=await this.api(`/api/technicals/${s}?period=${this.chartPeriod}`);
                if(!t||!t.length){this.chartAiInsight='No technical data available.';this.chartAiLoading=false;return}
                const last=t[t.length-1];
                const ctx=`Stock: ${s} (${this.analysisData.name})\nCurrent Price: $${this.analysisData.price?.toFixed(2)}\nPeriod: ${this.chartPeriod}\n\nLatest Technical Indicators:\n- SMA20: ${last.SMA20?.toFixed(2)||'N/A'}\n- SMA50: ${last.SMA50?.toFixed(2)||'N/A'}\n- RSI(14): ${last.RSI?.toFixed(1)||'N/A'}\n- MACD: ${last.MACD?.toFixed(3)||'N/A'}\n- MACD Signal: ${last.Signal?.toFixed(3)||'N/A'}\n- MACD Histogram: ${last.MACD_Hist?.toFixed(3)||'N/A'}\n- Bollinger Upper: ${last.BB_Upper?.toFixed(2)||'N/A'}\n- Bollinger Lower: ${last.BB_Lower?.toFixed(2)||'N/A'}\n- Close: ${last.Close?.toFixed(2)||'N/A'}\n\nPrice vs SMA20: ${last.Close>last.SMA20?'Above':'Below'}\nPrice vs SMA50: ${last.Close>last.SMA50?'Above':'Below'}\nSMA20 vs SMA50: ${last.SMA20>last.SMA50?'Bullish crossover':'Bearish crossover'}`;
                const r=await this.post('/api/chat/chart-insight',{chart_context:ctx});this.chartAiInsight=r.reply||r.error||'Unable to generate insight.';
            }catch(e){this.chartAiInsight='Connection error. Please try again.'}
            this.chartAiLoading=false;
        },
        async getFundamentalsSummary(){
            if(!this.fundamentalsData||!this.analysisData||this.fundAiLoading)return;
            this.fundAiLoading=true;this.fundAiSummary=null;
            const fd=this.fundamentalsData,s=this.analysisData.symbol;
            const fk=Object.keys(fd.financials||{}).sort(),ck=Object.keys(fd.cashflow||{}).sort(),bk=Object.keys(fd.balanceSheet||{}).sort();
            let ctx=`Stock: ${s} (${this.analysisData.name})\nSector: ${this.analysisData.sector}\nPrice: $${this.analysisData.price?.toFixed(2)}\n\n`;
            if(fk.length){ctx+='Income Statement (annual, $M):\n';for(const d of fk.slice(-4)){const r=fd.financials[d];ctx+=`${d.substring(0,4)}: Revenue ${Math.round((r?.['Total Revenue']||0)/1e6)}, Net Income ${Math.round((r?.['Net Income']||0)/1e6)}, Gross Profit ${Math.round((r?.['Gross Profit']||0)/1e6)}, Operating Income ${Math.round((r?.['Operating Income']||0)/1e6)}\n`}}
            if(ck.length){ctx+='\nCash Flow (annual, $M):\n';for(const d of ck.slice(-4)){const r=fd.cashflow[d];ctx+=`${d.substring(0,4)}: Op CF ${Math.round((r?.['Operating Cash Flow']||0)/1e6)}, CapEx ${Math.round((r?.['Capital Expenditure']||0)/1e6)}, FCF ${Math.round(((r?.['Operating Cash Flow']||0)+(r?.['Capital Expenditure']||0))/1e6)}\n`}}
            if(bk.length){ctx+='\nBalance Sheet (latest, $M):\n';const r=fd.balanceSheet[bk[bk.length-1]];ctx+=`Total Assets ${Math.round((r?.['Total Assets']||0)/1e6)}, Total Liabilities ${Math.round((r?.['Total Liabilities Net Minority Interest']||0)/1e6)}, Cash ${Math.round((r?.['Cash And Cash Equivalents']||0)/1e6)}, Total Debt ${Math.round((r?.['Total Debt']||0)/1e6)}, Equity ${Math.round((r?.['Stockholders Equity']||0)/1e6)}\n`}
            try{const r=await this.post('/api/chat/fundamentals',{fundamentals_context:ctx});this.fundAiSummary=r.reply||r.error||'Unable to generate analysis.'}catch(e){this.fundAiSummary='Connection error. Please try again.'}
            this.fundAiLoading=false;
        },

        // ── AI Watchlist Digest ──
        async getWatchlistDigest(){
            if(!this.watchlist.length||this.watchlistDigestLoading)return;
            this.watchlistDigestLoading=true;this.showWatchlistDigest=true;this.watchlistDigest=null;
            const lines=this.watchlist.map(w=>`${w.symbol} (${w.name||''}): $${(w.price||0).toFixed(2)}, ${w.changePercent>=0?'+':''}${(w.changePercent||0).toFixed(2)}%`);
            const ctx=`My watchlist today:\n\n${lines.join('\n')}`;
            try{const r=await this.post('/api/chat/watchlist-digest',{watchlist_context:ctx});this.watchlistDigest=r.reply||r.error||'Unable to generate digest.'}catch(e){this.watchlistDigest='Connection error. Please try again.'}
            this.watchlistDigestLoading=false;
        },

        // ── Peer Comparison ──
        async loadPeers(s){
            if(!s)return;this.peerLoading=true;this.peerData=null;
            try{this.peerData=await this.api(`/api/peers/${s}`)}catch(e){}
            this.peerLoading=false;
        },

        // ── Portfolio Optimizer ──
        async runOptimizer(){
            if(!this.portfolio.length||this.optimizerLoading)return;
            this.optimizerLoading=true;this.showOptimizer=true;this.optimizerResult=null;
            const syms=[...new Set(this.portfolio.map(h=>h.symbol))];
            if(syms.length<2){this.optimizerResult={error:'Need at least 2 different stocks to optimize.'};this.optimizerLoading=false;return}
            try{const r=await this.post('/api/portfolio/optimize',{symbols:syms});if(r.error){this.optimizerResult={error:r.error}}else{this.optimizerResult=r;this.$nextTick(()=>{this.renderEfficientFrontier();this.renderOptimalWeights()})}}catch(e){this.optimizerResult={error:'Connection error.'}}
            this.optimizerLoading=false;
        },
        renderEfficientFrontier(){
            if(!this.optimizerResult||this.optimizerResult.error)return;const c=this.tc(),d=this.optimizerResult;
            const pts=d.frontier.map(p=>([p.risk,p.return]));
            this.renderApex('opt-frontier',{chart:{type:'scatter',height:320,background:'transparent',toolbar:{show:false},zoom:{enabled:false}},series:[{name:'Portfolios',data:pts},{name:'Optimal',data:[[d.optimal.risk,d.optimal.return]]},{name:'Min Vol',data:[[d.minVol.risk,d.minVol.return]]}],xaxis:{title:{text:'Risk (Annual Vol %)',style:{color:c.at,fontSize:'11px'}},labels:{style:{colors:c.at},formatter:v=>v.toFixed(1)+'%'},tickAmount:6},yaxis:{title:{text:'Return (%)',style:{color:c.at,fontSize:'11px'}},labels:{style:{colors:c.at},formatter:v=>v.toFixed(1)+'%'}},colors:['rgba(99,102,241,.25)','#10b981','#f59e0b'],markers:{size:[3,12,12],strokeWidth:[0,2,2],strokeColors:['transparent','#fff','#fff']},legend:{labels:{colors:c.at},position:'top'},theme:{mode:c.am},grid:{borderColor:c.ag,strokeDashArray:3},tooltip:{theme:c.am,custom:({seriesIndex,dataPointIndex,w})=>{const p=w.config.series[seriesIndex].data[dataPointIndex];return`<div class="px-3 py-2 text-xs"><b>${w.config.series[seriesIndex].name}</b><br>Risk: ${p[0].toFixed(1)}% | Return: ${p[1].toFixed(1)}%</div>`}}});
        },
        renderOptimalWeights(){
            if(!this.optimizerResult||this.optimizerResult.error)return;const c=this.tc(),d=this.optimizerResult;
            const syms=Object.keys(d.optimal.weights),wts=syms.map(s=>Math.round(d.optimal.weights[s]*1000)/10);
            this.renderApex('opt-weights',{chart:{type:'donut',height:260,background:'transparent'},series:wts,labels:syms,colors:['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f97316','#ec4899'],theme:{mode:c.am},plotOptions:{pie:{donut:{size:'60%',labels:{show:true,name:{color:c.at},value:{color:c.at,formatter:v=>v.toFixed(1)+'%'},total:{show:true,label:'Sharpe',color:c.at,formatter:()=>d.optimal.sharpe.toFixed(2)}}}}},legend:{position:'bottom',labels:{colors:c.at}},stroke:{colors:[c.bg]},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>v.toFixed(1)+'%'}}});
        },

        // ── Earnings Surprise Tracker ──
        async loadEarningsHistory(s){
            if(!s)return;this.earningsHistoryLoading=true;this.earningsHistorySymbol=s;this.earningsHistory=null;
            try{const d=await this.api(`/api/earnings-history/${s}`);this.earningsHistory=d.history||[];this.$nextTick(()=>this.renderEarningsChart())}catch(e){this.earningsHistory=[]}
            this.earningsHistoryLoading=false;
        },
        renderEarningsChart(){
            if(!this.earningsHistory||!this.earningsHistory.length)return;
            const c=this.tc(),h=this.earningsHistory.filter(e=>e.epsEstimate!=null&&e.epsActual!=null).reverse();
            if(!h.length)return;
            const dates=h.map(e=>e.date.substring(0,7)),est=h.map(e=>e.epsEstimate),act=h.map(e=>e.epsActual);
            this.renderApex('earnings-surprise',{chart:{type:'bar',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Estimate',data:est},{name:'Actual',data:act}],xaxis:{categories:dates,labels:{style:{colors:c.at,fontSize:'10px'}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toFixed(2)}},colors:['#64748b','#6366f1'],plotOptions:{bar:{borderRadius:4,columnWidth:'55%',dataLabels:{position:'top'}}},dataLabels:{enabled:true,formatter:v=>'$'+v.toFixed(2),style:{fontSize:'9px',colors:[c.at]},offsetY:-18},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at},position:'top'},tooltip:{theme:c.am,y:{formatter:v=>'$'+v.toFixed(2)}},annotations:{points:h.map((e,i)=>e.beat!=null?{x:dates[i],y:e.epsActual,seriesIndex:1,marker:{size:0},label:{text:e.beat?'BEAT':'MISS',borderColor:e.beat?'#10b981':'#ef4444',style:{background:e.beat?'#10b981':'#ef4444',color:'#fff',fontSize:'8px',padding:{left:3,right:3,top:1,bottom:1}},offsetY:-8}}:null).filter(Boolean)}});
        },

        // ── Export CSV ──
        _downloadCSV(filename,rows){
            const csv=rows.map(r=>r.map(c=>{const s=String(c??'');return s.includes(',')||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\n');
            const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
        },
        exportPortfolioCSV(){
            if(!this.portfolio.length)return;
            const rows=[['Symbol','Name','Shares','Buy Price','Current Price','Value','P&L','Return %']];
            for(const h of this.portfolio){rows.push([h.symbol,h.name||'',h.shares,h.buy_price,(h.currentPrice||0).toFixed(2),((h.currentPrice||0)*h.shares).toFixed(2),this.hpl(h).toFixed(2),this.hret(h).toFixed(2)])}
            rows.push([]);rows.push(['Total','','','','',this.ptv().toFixed(2),this.ptp().toFixed(2),this.ptr().toFixed(2)]);
            this._downloadCSV('portfolio_'+new Date().toISOString().split('T')[0]+'.csv',rows);
        },
        exportCompareCSV(){
            if(!this.compareData)return;
            const syms=Object.keys(this.compareData);
            const rows=[['Metric',...syms]];
            for(const m of this.compareMetrics){rows.push([m.label,...syms.map(s=>this.fmtMetric(this.compareData[s]?.[m.key],m.format))])}
            this._downloadCSV('compare_'+syms.join('_')+'_'+new Date().toISOString().split('T')[0]+'.csv',rows);
        },
        exportAnalysisCSV(){
            if(!this.analysisData)return;
            const d=this.analysisData;
            const rows=[['Stock Analysis Export'],[],['Symbol',d.symbol],['Name',d.name],['Price',d.price],['Change',d.change],['Change %',d.changePercent],[],['Key Stats']];
            for(const s of this.analysisStats){rows.push([s.label,s.value])}
            if(this.stockScore){rows.push([]);rows.push(['AI Health Score']);rows.push(['Overall',this.stockScore.overallScore]);rows.push(['Rating',this.stockScore.rating]);for(const cat of this.scoreCategories){if(this.stockScore.scores?.[cat.key]!=null)rows.push([cat.label,this.stockScore.scores[cat.key]])}}
            this._downloadCSV('analysis_'+d.symbol+'_'+new Date().toISOString().split('T')[0]+'.csv',rows);
        },

        // ── Streaming AI Chat ──
        async sendChatStreaming(){
            const msg=this.chatInput.trim();if(!msg||this.chatLoading)return;
            this.chatMessages.push({role:'user',content:msg});this.chatInput='';this.chatLoading=true;
            this.$nextTick(()=>this.scrollChat());
            this.chatMessages.push({role:'assistant',content:''});
            const aiIdx=this.chatMessages.length-1;
            try{
                const resp=await fetch(API_BASE+'/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json',...this.authH()},body:JSON.stringify({messages:this.chatMessages.slice(0,-1).filter(m=>m.content)})});
                if(!resp.ok){this.chatMessages[aiIdx].content='Sorry, I couldn\'t process that.';this.chatLoading=false;return}
                const reader=resp.body.getReader();const decoder=new TextDecoder();let buf='';
                while(true){
                    const{done,value}=await reader.read();if(done)break;
                    buf+=decoder.decode(value,{stream:true});
                    const lines=buf.split('\n');buf=lines.pop()||'';
                    for(const line of lines){
                        if(!line.startsWith('data: '))continue;
                        const payload=line.slice(6).trim();
                        if(payload==='[DONE]')break;
                        try{const d=JSON.parse(payload);if(d.content){this.chatMessages[aiIdx].content+=d.content;this.$nextTick(()=>this.scrollChat())}}catch(e){}
                    }
                }
                if(!this.chatMessages[aiIdx].content)this.chatMessages[aiIdx].content='Sorry, I couldn\'t process that.';
            }catch(e){this.chatMessages[aiIdx].content='Connection error. Please try again.'}
            this.chatLoading=false;this.$nextTick(()=>this.scrollChat());
        },

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
        async sendChat(){return this.sendChatStreaming()},
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
