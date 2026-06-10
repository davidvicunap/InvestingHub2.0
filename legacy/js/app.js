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
        darkMode: localStorage.getItem('investorhub-theme')==='dark' || (!localStorage.getItem('investorhub-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches),
        connectionError:false, retrying:false, backendWaking:false,

        authToken: localStorage.getItem('investorhub-token')||'',
        currentUser: JSON.parse(localStorage.getItem('investorhub-user')||'null'),
        authPage:'login',
        showLoginModal:false, showRegisterModal:false, authError:'', authLoading:false,
        loginForm:{email:'',password:''}, registerForm:{name:'',email:'',password:''},

        navItems: [
            {id:'dashboard',label:'Dashboard',icon:'<svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>'},
            {id:'analysis',label:'Analysis',icon:'<svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>'},
            {id:'compare',label:'Compare',icon:'<svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>'},
            {id:'charting',label:'Charting',icon:'<svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3v18h18M7 14l3-3 3 2 5-6"/></svg>'},
            {id:'portfolio',label:'Portfolio',icon:'<svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'},
        ],

        marketData:[], marketLoading:false,
        movers:{gainers:[],losers:[]}, moversLoading:false,
        watchlist:[], watchlistLoading:false,
        portfolio:[], portfolioLoading:false,
        portfolioAnalytics:null, portfolioAnalyticsLoading:false,
        showAddHolding:false, newHolding:{symbol:'',shares:'',buy_price:'',buy_date:'',notes:''},
        showEditHolding:false, editingHolding:{id:null,symbol:'',shares:'',buy_price:'',buy_date:'',notes:''},

        analysisSymbol:'', analysisData:null, analysisStats:[], analysisLoading:false,
        analysisTab:'Overview', analysisTabs:['Overview','Chart','Technicals','Fundamentals','Financials','Dividends','SEC Filings','Profile'],
        chartPeriod:'1y', techPeriod:'1y',
        fundamentalsData:null, finTab:'income', finPeriod:'annual',
        stockScore:null,
        secFilings:null, secFilingsLoading:false,
        returnsData:null, valuationData:null, analystData:null, earningsData:null,
        dividendData:null, dividendLoading:false,
        returnPeriods:['1W','1M','3M','6M','YTD','1Y','3Y','5Y'],
        scoreCategories:[
            {key:'profitability',label:'Profitability',desc:'Margins & ROE',weight:25},
            {key:'growth',label:'Growth',desc:'Revenue & Earnings',weight:20},
            {key:'valuation',label:'Valuation',desc:'P/E, P/B & PEG',weight:20},
            {key:'financialHealth',label:'Financial Health',desc:'Debt & Liquidity',weight:20},
            {key:'momentum',label:'Momentum',desc:'Price Trends',weight:15},
        ],

        compareInput:'', compareData:null, compareLoading:false, comparePeriod:'1y',
        cmpColors:['#2563eb','#10b981','#f59e0b','#ef4444','#06b6d4'],
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

        peerData:null, peerLoading:false,

        // ── Charting page ──
        chartingSymbol:'', chartingInput:'', metricsData:null, metricsLoading:false, chartError:'',
        chartFreq:'annual', chartRange:99, chartOverlay:'none',
        selectedMetrics:['revenue','netMargin'],
        metricColors:['#2563eb','#10b981','#f59e0b','#8b5cf6'],
        chartingExamples:['AAPL','MSFT','GOOGL','NVDA','AMZN'],

        apex:{}, tv:{},
        _apiCache:{},
        _cacheTTLs:{'/api/market':60,'/api/watchlist':30,'/api/portfolio':30,'/api/portfolio/analytics':30,'/api/movers':120},
        _cachePrefixTTLs:[['/api/quote/',60],['/api/history/',600],['/api/technicals/',300],['/api/fundamentals/',3600],['/api/score/',1800],['/api/sec-filings/',3600],['/api/peers/',1800],['/api/compare?',300],['/api/returns/',600],['/api/dividends/',3600],['/api/analysts/',1800],['/api/valuation/',1800],['/api/earnings/',3600],['/api/metrics/',3600]],

        init() {
            this.applyTheme();
            this._hydrateCache();            // restore last-known data from localStorage
            if(this.authToken)this._showCached();  // paint it instantly (before the backend even wakes)
            this._warmBackend();             // then refresh once the backend responds
            this._waitForLibs();
        },
        // Paint the dashboard from persisted cache immediately so a returning
        // visitor sees content right away instead of skeletons during the
        // free-tier cold start. Fresh data overwrites it once the backend wakes.
        _showCached(){
            const mk=this._staleGet('/api/market'); if(mk&&mk.length)this.marketData=mk;
            const mv=this._staleGet('/api/movers'); if(mv&&!mv.error)this.movers=mv;
            const wl=this._staleGet('/api/watchlist'); if(Array.isArray(wl))this.watchlist=wl;
            const pf=this._staleGet('/api/portfolio'); if(Array.isArray(pf)){this.portfolio=pf;this.$nextTick(()=>{if(pf.length)this.renderPortCharts()})}
        },
        async _warmBackend(){
            // Poll the health endpoint until the backend is up (free-tier cold
            // starts can take 1-3 min). Auto-connects without a manual retry.
            this.backendWaking=true; this.connectionError=false;
            const deadline=Date.now()+240000; let attempt=0;
            while(Date.now()<deadline){
                try{
                    await fetch(API_BASE+'/',{signal:AbortSignal.timeout(10000)});
                    this.connectionError=false; this.backendWaking=false;
                    if(this.authToken){this.loadMarketData();this.loadWatchlist();this.loadPortfolio();this.loadMovers()}
                    return;
                }catch(e){
                    attempt++;
                    await new Promise(r=>setTimeout(r,Math.min(3000,400*attempt)));
                }
            }
            this.backendWaking=false; this.connectionError=true;
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
            if(this.backendWaking){this.authError='Server is starting up, please wait a moment...';this.authLoading=false;return}
            try {
                const r=await fetch(API_BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.loginForm),signal:AbortSignal.timeout(30000)});
                const d=await r.json();
                if(!r.ok){this.authError=d.error||'Failed';this.authLoading=false;return}
                this.authToken=d.token;this.currentUser=d.user;
                localStorage.setItem('investorhub-token',d.token);localStorage.setItem('investorhub-user',JSON.stringify(d.user));
                this.showLoginModal=false;this.loginForm={email:'',password:''};
                this.loadMarketData();this.loadPortfolio();this.loadWatchlist();this.loadMovers();
            } catch(e){this.authError=e.name==='TimeoutError'?'Server is waking up — please try again in a few seconds.':'Connection error — the server may be starting up. Please try again.'}
            this.authLoading=false;
        },
        async register() {
            this.authError=''; this.authLoading=true;
            if(this.backendWaking){this.authError='Server is starting up, please wait a moment...';this.authLoading=false;return}
            try {
                const r=await fetch(API_BASE+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.registerForm),signal:AbortSignal.timeout(30000)});
                const d=await r.json();
                if(!r.ok){this.authError=d.error||'Failed';this.authLoading=false;return}
                this.authToken=d.token;this.currentUser=d.user;
                localStorage.setItem('investorhub-token',d.token);localStorage.setItem('investorhub-user',JSON.stringify(d.user));
                this.showRegisterModal=false;this.registerForm={name:'',email:'',password:''};
                this.loadMarketData();this.loadPortfolio();this.loadWatchlist();this.loadMovers();
            } catch(e){this.authError=e.name==='TimeoutError'?'Server is waking up — please try again in a few seconds.':'Connection error — the server may be starting up. Please try again.'}
            this.authLoading=false;
        },
        logout() {
            this.authToken='';this.currentUser=null;localStorage.removeItem('investorhub-token');localStorage.removeItem('investorhub-user');
            this.portfolio=[];this.watchlist=[];this.marketData=[];this.currentPage='dashboard';this.clearCache();
        },

        // ── Theme ──
        toggleTheme(){this.darkMode=!this.darkMode;this.applyTheme();localStorage.setItem('investorhub-theme',this.darkMode?'dark':'light');this.reRender()},
        applyTheme(){document.documentElement.classList.toggle('dark',this.darkMode)},
        tc(){return this.darkMode?{bg:'#161619',grid:'#26262b',text:'#8a8a93',cross:'#5a5a63',border:'#2a2a30',up:'#10b981',dn:'#ef4444',vUp:'rgba(16,185,129,.25)',vDn:'rgba(239,68,68,.25)',line:'#e4e4e7',am:'dark',ag:'#26262b',at:'#8a8a93'}:{bg:'#ffffff',grid:'#eeeef1',text:'#6e6e76',cross:'#a1a1aa',border:'#e7e7ec',up:'#10b981',dn:'#ef4444',vUp:'rgba(16,185,129,.3)',vDn:'rgba(239,68,68,.3)',line:'#3f3f46',am:'light',ag:'#eeeef1',at:'#6e6e76'}},
        reRender(){if(this.currentPage==='analysis'&&this.analysisData){if(this.analysisTab==='Overview')this.renderEarningsChart();if(this.analysisTab==='Chart')this.loadPriceChart();if(this.analysisTab==='Technicals')this.loadTech();if(this.analysisTab==='Fundamentals'&&this.fundamentalsData)this.renderFundCharts();if(this.analysisTab==='Dividends')this.renderDividendChart()}if(this.currentPage==='compare'&&this.compareData){this.renderCmpChart();this.renderCmpRadar()}if(this.currentPage==='portfolio'){if(this.portfolio.length)this.renderPortCharts();this.renderSectorChart()}if(this.currentPage==='dashboard'&&this.portfolio.length)this.renderPortCharts();if(this.currentPage==='charting'&&this.metricsData)this.renderMetricChart()},

        // ── Nav ──
        navigate(p){this.currentPage=p;if(p==='dashboard'){this.loadMarketData();this.loadWatchlist();this.loadPortfolio();this.loadMovers()}if(p==='portfolio'){this.loadPortfolioAnalytics();this.$nextTick(()=>{if(this.portfolio.length)this.renderPortCharts();this.renderSectorChart()})}if(p==='charting'&&this.metricsData)this.$nextTick(()=>this.renderMetricChart())},
        selectStock(s){if(!s)return;this.analysisSymbol=s;this.currentPage='analysis';this.loadAnalysis(s)},
        switchTab(t){this.analysisTab=t;const s=this.analysisData?.symbol;this.$nextTick(()=>{if(t==='Overview')this.renderEarningsChart();if(t==='Chart')this.loadPriceChart();if(t==='Technicals')this.loadTech();if(t==='Fundamentals'){this.fundamentalsData?this.renderFundCharts():this.loadFundamentals(s)}if(t==='Financials'&&!this.fundamentalsData)this.loadFundamentals(s);if(t==='Dividends'){this.dividendData?this.renderDividendChart():this.loadDividends(s)}if(t==='SEC Filings'&&!this.secFilings)this.loadSecFilings(s)})},

        // ── Helpers ──
        _logoDomain(s){const c=s.replace('^','').replace('-USD','').replace('=F','').toUpperCase();return LOGO_DOMAINS[c]||c.toLowerCase()+'.com'},
        logoUrl(s){if(!s)return'';return`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${this._logoDomain(s)}&size=128`},
        logoFallback(s){if(!s)return'';return`https://icons.duckduckgo.com/ip3/${this._logoDomain(s)}.ico`},
        scoreColor(v){return v>=7?'#10b981':v>=5?'#f59e0b':'#ef4444'},
        fmtP(v){if(!v&&v!==0)return'—';return'$'+parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})},
        fmtBig(v){if(!v)return'—';const n=parseFloat(v);if(n>=1e12)return'$'+(n/1e12).toFixed(2)+'T';if(n>=1e9)return'$'+(n/1e9).toFixed(2)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(2)+'M';return'$'+n.toLocaleString()},
        fmtPct(v){if(!v&&v!==0)return'—';return(parseFloat(v)*100).toFixed(2)+'%'},
        fmtMetric(v,f){if(v==null)return'—';if(f==='price')return this.fmtP(v);if(f==='mcap')return this.fmtBig(v);if(f==='pct')return this.fmtPct(v);if(f==='rpct')return parseFloat(v).toFixed(2)+'%';if(f==='num')return parseFloat(v).toFixed(2);if(f==='txt')return v||'—';return v},
        metricColor(v){return(!v&&v!==0)?'fg-0':parseFloat(v)>=0?'text-emerald-500':'text-red-500'},
        timeAgo(ts){if(!ts)return'';const s=(Date.now()/1000-ts);if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';if(s<604800)return Math.floor(s/86400)+'d';return new Date(ts*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})},
        fmtRet(v){return v==null?'—':(v>=0?'+':'')+parseFloat(v).toFixed(1)+'%'},
        retClass(v){return v==null?'fg-3':parseFloat(v)>=0?'text-emerald-500':'text-red-500'},
        fmtUnixDate(ts){if(!ts)return'—';return new Date(ts*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})},
        rangePct(v,lo,hi){if(!v||!hi||hi<=lo)return 50;return Math.min(100,Math.max(0,(v-lo)/(hi-lo)*100))},
        ratingRows(){const d=this.analystData?.distribution||{};return[{key:'strongBuy',label:'Strong Buy',count:d.strongBuy||0,color:'#10b981'},{key:'buy',label:'Buy',count:d.buy||0,color:'#34d399'},{key:'hold',label:'Hold',count:d.hold||0,color:'#f59e0b'},{key:'sell',label:'Sell',count:d.sell||0,color:'#f87171'},{key:'strongSell',label:'Strong Sell',count:d.strongSell||0,color:'#ef4444'}]},
        hasEarningsHistory(){return(this.earningsData?.history||[]).some(h=>h.epsActual!=null)},
        relSpy(){const a=this.portfolioAnalytics;if(!a||a.spyDayChange==null)return 0;return(a.dayChangePct||0)-a.spyDayChange},

        // ── API ──
        _getCacheTTL(u){
            const exact=this._cacheTTLs[u];if(exact)return exact;
            for(const[p,t]of this._cachePrefixTTLs)if(u.startsWith(p))return t;
            return 0;
        },
        clearCache(pattern){if(!pattern){this._apiCache={};try{localStorage.removeItem('ih-cache')}catch(e){}return}for(const k of Object.keys(this._apiCache))if(k.includes(pattern))delete this._apiCache[k];this._persistCache()},
        _hydrateCache(){try{const raw=localStorage.getItem('ih-cache');if(raw){const o=JSON.parse(raw);if(o&&typeof o==='object')this._apiCache=o}}catch(e){}},
        _persistCache(){try{const ks=Object.keys(this._apiCache);ks.sort((a,b)=>this._apiCache[b].t-this._apiCache[a].t);const o={};let n=0;for(const k of ks){if(n>=40)break;try{const s=JSON.stringify(this._apiCache[k]);if(s.length>80000)continue;o[k]=this._apiCache[k];n++}catch(e){}}localStorage.setItem('ih-cache',JSON.stringify(o))}catch(e){}},
        _staleGet(u){const c=this._apiCache[u];return c?c.d:null},
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
                    this._persistCache();   // survive reloads for instant next-visit paint
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
        async loadMarketData(){if(!this.marketData.length)this.marketLoading=true;try{this.marketData=await this.api('/api/market')}catch(e){}this.marketLoading=false},
        async loadMovers(){if(!(this.movers.gainers.length||this.movers.losers.length))this.moversLoading=true;try{const m=await this.api('/api/movers');if(m&&!m.error)this.movers=m}catch(e){}this.moversLoading=false},
        edgarUrl(sym,form){return`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(sym)}&type=${encodeURIComponent(form)}&dateb=&owner=include&count=10&search_text=&action=getcompany`},
        async loadSecFilings(s){
            if(!s)return;this.secFilingsLoading=true;
            try{this.secFilings=await this.api(`/api/sec-filings/${s}`)}catch(e){
                this.secFilings={symbol:s,filings:[],fallback:true,edgarUrl:this.edgarUrl(s,'')};
            }
            this.secFilingsLoading=false;
        },

        // ── Watchlist ──
        async loadWatchlist(){if(!this.watchlist.length)this.watchlistLoading=true;try{this.watchlist=await this.api('/api/watchlist')}catch(e){}this.watchlistLoading=false},
        async addToWatchlist(s){if(!s)return;await this.post('/api/watchlist',{symbol:s.toUpperCase()});this.clearCache('/api/watchlist');this.loadWatchlist()},
        async removeFromWatchlist(s){await this.del(`/api/watchlist/${s}`);this.clearCache('/api/watchlist');this.loadWatchlist()},

        // ── Portfolio ──
        async loadPortfolio(){if(!this.portfolio.length)this.portfolioLoading=true;try{this.portfolio=await this.api('/api/portfolio');if(this.currentPage==='dashboard'||this.currentPage==='portfolio')this.$nextTick(()=>{if(this.portfolio.length)this.renderPortCharts()})}catch(e){}this.portfolioLoading=false;if(this.portfolio.length)this.loadPortfolioAnalytics()},
        async loadPortfolioAnalytics(){if(!this.authToken)return;this.portfolioAnalyticsLoading=true;try{const a=await this.api('/api/portfolio/analytics');if(a&&!a.error){this.portfolioAnalytics=a;if(a.sectorAllocation?.length)this.$nextTick(()=>this.renderSectorChart())}}catch(e){}this.portfolioAnalyticsLoading=false},
        renderSectorChart(){const a=this.portfolioAnalytics;if(!a?.sectorAllocation?.length||!document.getElementById('p-sector'))return;const c=this.tc();this.renderApex('p-sector',{chart:{type:'donut',height:260,background:'transparent'},series:a.sectorAllocation.map(s=>s.value),labels:a.sectorAllocation.map(s=>s.sector),colors:['#2563eb','#06b6d4','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899','#64748b','#14b8a6','#a855f7'],theme:{mode:c.am},plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{color:c.at,fontSize:'12px'},value:{color:c.at,formatter:v=>'$'+parseFloat(v).toLocaleString(undefined,{maximumFractionDigits:0})},total:{show:true,color:c.at,label:'Sectors',formatter:()=>a.sectorAllocation.length}}}}},legend:{position:'bottom',labels:{colors:c.at},fontSize:'11px'},stroke:{colors:[c.bg]},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+parseFloat(v).toLocaleString(undefined,{maximumFractionDigits:0})}}})},
        async addHolding(){if(!this.newHolding.symbol||!this.newHolding.shares||!this.newHolding.buy_price)return;await this.post('/api/portfolio',this.newHolding);this.newHolding={symbol:'',shares:'',buy_price:'',buy_date:'',notes:''};this.showAddHolding=false;this.clearCache('/api/portfolio');this.loadPortfolio()},
        async deleteHolding(id){await this.del(`/api/portfolio/${id}`);this.clearCache('/api/portfolio');this.loadPortfolio()},
        openEditHolding(h){this.editingHolding={id:h.id,symbol:h.symbol,shares:h.shares,buy_price:h.buy_price,buy_date:h.buy_date||'',notes:h.notes||''};this.showEditHolding=true},
        async saveEditHolding(){if(!this.editingHolding.id)return;await this.put(`/api/portfolio/${this.editingHolding.id}`,{shares:parseFloat(this.editingHolding.shares),buy_price:parseFloat(this.editingHolding.buy_price),buy_date:this.editingHolding.buy_date,notes:this.editingHolding.notes});this.showEditHolding=false;this.clearCache('/api/portfolio');this.loadPortfolio()},
        hpl(h){return((h.currentPrice||0)-h.buy_price)*h.shares},
        hret(h){return h.buy_price?(((h.currentPrice||0)-h.buy_price)/h.buy_price)*100:0},
        ptv(){return this.portfolio.reduce((s,h)=>s+(h.currentPrice||0)*h.shares,0)},
        ptc(){return this.portfolio.reduce((s,h)=>s+h.buy_price*h.shares,0)},
        ptp(){return this.ptv()-this.ptc()},
        ptr(){const c=this.ptc();return c?((this.ptv()-c)/c)*100:0},

        renderPortCharts(){
            if(!this.portfolio.length)return;const c=this.tc();
            const lb=this.portfolio.map(h=>h.symbol),vl=this.portfolio.map(h=>Math.round((h.currentPrice||0)*h.shares*100)/100);
            const pie=(id,ht)=>({chart:{type:'donut',height:ht,background:'transparent'},series:vl,labels:lb,colors:['#2563eb','#06b6d4','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899'],theme:{mode:c.am},plotOptions:{pie:{donut:{size:'65%',labels:{show:true,name:{color:c.at},value:{color:c.at,formatter:v=>'$'+parseFloat(v).toLocaleString()},total:{show:true,color:c.at,label:'Total',formatter:w=>'$'+w.globals.seriesTotals.reduce((a,b)=>a+b,0).toLocaleString()}}}}},legend:{position:'bottom',labels:{colors:c.at}},stroke:{colors:[c.bg]},dataLabels:{enabled:false}});
            if(document.getElementById('p-alloc'))this.renderApex('p-alloc',pie('a',260));
            if(document.getElementById('dash-pie'))this.renderApex('dash-pie',{...pie('d',190),plotOptions:{pie:{donut:{size:'70%'}}}});
            const pl=this.portfolio.map(h=>Math.round(this.hpl(h)*100)/100);
            if(document.getElementById('p-perf'))this.renderApex('p-perf',{chart:{type:'bar',height:260,background:'transparent',toolbar:{show:false}},series:[{name:'P&L',data:pl}],xaxis:{categories:lb,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toLocaleString()}},colors:pl.map(v=>v>=0?'#10b981':'#ef4444'),plotOptions:{bar:{distributed:true,borderRadius:5,columnWidth:'55%'}},theme:{mode:c.am},grid:{borderColor:c.ag,strokeDashArray:3},legend:{show:false},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+v.toLocaleString('en-US',{minimumFractionDigits:2})}}});
        },

        // ── Analysis ──
        async loadAnalysis(s){
            if(!s)return;s=s.toUpperCase().trim();this.analysisSymbol=s;this.analysisLoading=true;
            this.analysisData=null;this.analysisStats=[];this.fundamentalsData=null;this.stockScore=null;this.secFilings=null;this.analysisTab='Overview';this.peerData=null;
            this.returnsData=null;this.valuationData=null;this.analystData=null;this.earningsData=null;this.dividendData=null;
            // Fire every request in parallel — none depend on the quote, so don't
            // serialize behind it; the header lands first and each card fills in
            // as its own response arrives.
            this.api(`/api/quote/${s}`).then(d=>{
                if(!d||d.error)return;
                this.analysisData=d;
                this.analysisStats=[
                    {label:'Mkt Cap',value:this.fmtBig(d.marketCap)},{label:'P/E',value:d.peRatio?d.peRatio.toFixed(2):'—'},
                    {label:'Fwd P/E',value:d.forwardPE?d.forwardPE.toFixed(2):'—'},{label:'EPS',value:d.eps?'$'+d.eps.toFixed(2):'—'},
                    {label:'Div Yield',value:d.dividendYield?(d.dividendYield*100).toFixed(2)+'%':'—'},{label:'Beta',value:d.beta?d.beta.toFixed(2):'—'},
                    {label:'52W High',value:this.fmtP(d.fiftyTwoWeekHigh)},{label:'52W Low',value:this.fmtP(d.fiftyTwoWeekLow)},
                    {label:'Volume',value:d.volume?d.volume.toLocaleString():'—'},{label:'Avg Vol',value:d.avgVolume?d.avgVolume.toLocaleString():'—'},
                    {label:'Profit Margin',value:d.profitMargin?(d.profitMargin*100).toFixed(1)+'%':'—'},{label:'ROE',value:d.returnOnEquity?(d.returnOnEquity*100).toFixed(1)+'%':'—'},
                ];
            }).catch(e=>console.error(e)).finally(()=>{this.analysisLoading=false});
            this.api(`/api/returns/${s}`).then(r=>{if(!r.error)this.returnsData=r}).catch(()=>{});
            this.api(`/api/valuation/${s}`).then(v=>{if(!v.error)this.valuationData=v}).catch(()=>{});
            this.api(`/api/analysts/${s}`).then(a=>{if(!a.error)this.analystData=a}).catch(()=>{});
            this.api(`/api/earnings/${s}`).then(e=>{if(!e.error){this.earningsData=e;if(this.analysisTab==='Overview')this.$nextTick(()=>this.renderEarningsChart())}}).catch(()=>{});
            this.api(`/api/score/${s}`).then(sc=>{if(sc&&!sc.error)this.stockScore=sc}).catch(()=>{});
            this.loadPeers(s);
        },
        async loadDividends(s){if(!s)return;this.dividendLoading=true;try{const d=await this.api(`/api/dividends/${s}`);if(!d.error){this.dividendData=d;this.$nextTick(()=>this.renderDividendChart())}}catch(e){}this.dividendLoading=false},
        async loadFundamentals(s){if(!s||this.fundamentalsData)return;try{const f=await this.api(`/api/fundamentals/${s}`);if(!f.error){this.fundamentalsData=f;if(this.analysisTab==='Fundamentals')this.$nextTick(()=>this.renderFundCharts())}}catch(e){}},
        renderEarningsChart(){
            if(!this.earningsData||!document.getElementById('eps-chart'))return;const c=this.tc();
            const past=(this.earningsData.history||[]).filter(h=>h.epsActual!=null).slice(0,8).reverse();
            if(!past.length){this.renderApex('eps-chart',{chart:{type:'bar',height:10,background:'transparent'},series:[],noData:{text:'No earnings history'}});return}
            this.renderApex('eps-chart',{chart:{type:'bar',height:240,background:'transparent',toolbar:{show:false}},series:[{name:'Estimate',data:past.map(h=>h.epsEstimate)},{name:'Actual',data:past.map(h=>h.epsActual)}],xaxis:{categories:past.map(h=>h.date.slice(0,7)),labels:{style:{colors:c.at},rotate:-45}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+(v??0).toFixed(2)}},colors:['#94a3b8','#2563eb'],plotOptions:{bar:{borderRadius:4,columnWidth:'70%'}},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+(v??0).toFixed(2)}}});
        },
        renderDividendChart(){
            if(!this.dividendData?.history?.length||!document.getElementById('div-chart'))return;const c=this.tc(),h=this.dividendData.history;
            this.renderApex('div-chart',{chart:{type:'bar',height:260,background:'transparent',toolbar:{show:false}},series:[{name:'Dividend / share',data:h.map(x=>x.amount)}],xaxis:{categories:h.map(x=>x.year),labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+(v??0).toFixed(2)}},colors:['#10b981'],plotOptions:{bar:{borderRadius:4,columnWidth:'60%'}},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{show:false},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+(v??0).toFixed(4)}}});
        },
        analystDistTotal(){const d=this.analystData?.distribution;return d?(d.strongBuy+d.buy+d.hold+d.sell+d.strongSell):0},

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
            const ma=this.mkTv('tv-ma',340);if(ma){ma.addLineSeries({color:c.line,lineWidth:2}).setData(d.filter(r=>r.Close!=null).map(r=>({time:r.date,value:r.Close})));ma.addLineSeries({color:'#2563eb',lineWidth:1.5}).setData(d.filter(r=>r.SMA20!=null).map(r=>({time:r.date,value:r.SMA20})));ma.addLineSeries({color:'#f59e0b',lineWidth:1.5}).setData(d.filter(r=>r.SMA50!=null).map(r=>({time:r.date,value:r.SMA50})));ma.addLineSeries({color:'#06b6d4',lineWidth:1,lineStyle:2}).setData(d.filter(r=>r.BB_Upper!=null).map(r=>({time:r.date,value:r.BB_Upper})));ma.addLineSeries({color:'#06b6d4',lineWidth:1,lineStyle:2}).setData(d.filter(r=>r.BB_Lower!=null).map(r=>({time:r.date,value:r.BB_Lower})));ma.timeScale().fitContent()}
            const rsi=this.mkTv('tv-rsi',200);if(rsi){const rl=rsi.addLineSeries({color:'#8b5cf6',lineWidth:2,priceFormat:{type:'custom',formatter:v=>v.toFixed(1)}});rl.setData(d.filter(r=>r.RSI!=null).map(r=>({time:r.date,value:r.RSI})));rl.createPriceLine({price:70,color:'#ef4444',lineWidth:1,lineStyle:2,axisLabelVisible:true});rl.createPriceLine({price:30,color:'#10b981',lineWidth:1,lineStyle:2,axisLabelVisible:true});rsi.timeScale().fitContent()}
            const mc=this.mkTv('tv-macd',200);if(mc){mc.addLineSeries({color:'#2563eb',lineWidth:2}).setData(d.filter(r=>r.MACD!=null).map(r=>({time:r.date,value:r.MACD})));mc.addLineSeries({color:'#f59e0b',lineWidth:1.5}).setData(d.filter(r=>r.Signal!=null).map(r=>({time:r.date,value:r.Signal})));mc.addHistogramSeries({priceFormat:{type:'custom',formatter:v=>v.toFixed(3)}}).setData(d.filter(r=>r.MACD_Hist!=null).map(r=>({time:r.date,value:r.MACD_Hist,color:r.MACD_Hist>=0?'rgba(16,185,129,.6)':'rgba(239,68,68,.6)'})));mc.timeScale().fitContent()}}catch(e){}
        },

        renderFundCharts(){
            if(!this.fundamentalsData)return;const fd=this.fundamentalsData,c=this.tc();
            const fk=Object.keys(fd.financials||{}).sort(),yr=fk.map(d=>d.substring(0,4));
            const rev=fk.map(d=>{const v=fd.financials[d]?.['Total Revenue'];return v?Math.round(v/1e6):0});
            const ni=fk.map(d=>{const v=fd.financials[d]?.['Net Income'];return v?Math.round(v/1e6):0});
            this.renderApex('f-rev',{chart:{type:'bar',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Revenue ($M)',data:rev},{name:'Net Income ($M)',data:ni}],xaxis:{categories:yr,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toLocaleString()+'M'}},colors:['#2563eb','#10b981'],plotOptions:{bar:{borderRadius:5,columnWidth:'50%'}},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+v?.toLocaleString()+'M'}}});
            const gm=fk.map(d=>{const g=fd.financials[d]?.['Gross Profit'],r=fd.financials[d]?.['Total Revenue'];return g&&r?Math.round(g/r*1e4)/100:0});
            const om=fk.map(d=>{const o=fd.financials[d]?.['Operating Income'],r=fd.financials[d]?.['Total Revenue'];return o&&r?Math.round(o/r*1e4)/100:0});
            const nm=fk.map(d=>{const n=fd.financials[d]?.['Net Income'],r=fd.financials[d]?.['Total Revenue'];return n&&r?Math.round(n/r*1e4)/100:0});
            this.renderApex('f-margin',{chart:{type:'line',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Gross',data:gm},{name:'Operating',data:om},{name:'Net',data:nm}],xaxis:{categories:yr,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>v.toFixed(1)+'%'}},colors:['#2563eb','#f59e0b','#10b981'],stroke:{width:2.5,curve:'smooth'},markers:{size:4},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},tooltip:{theme:c.am,y:{formatter:v=>v?.toFixed(2)+'%'}}});
            const ck=Object.keys(fd.cashflow||{}).sort(),cy=ck.map(d=>d.substring(0,4));
            const ocf=ck.map(d=>{const v=fd.cashflow[d]?.['Operating Cash Flow'];return v?Math.round(v/1e6):0});
            const cap=ck.map(d=>{const v=fd.cashflow[d]?.['Capital Expenditure'];return v?Math.round(v/1e6):0});
            const fcf=ck.map((d,i)=>ocf[i]+cap[i]);
            this.renderApex('f-cf',{chart:{type:'bar',height:280,background:'transparent',toolbar:{show:false}},series:[{name:'Op CF ($M)',data:ocf},{name:'CapEx ($M)',data:cap},{name:'FCF ($M)',data:fcf}],xaxis:{categories:cy,labels:{style:{colors:c.at}}},yaxis:{labels:{style:{colors:c.at},formatter:v=>'$'+v.toLocaleString()+'M'}},colors:['#2563eb','#ef4444','#10b981'],plotOptions:{bar:{borderRadius:5,columnWidth:'50%'}},grid:{borderColor:c.ag,strokeDashArray:3},theme:{mode:c.am},legend:{labels:{colors:c.at}},dataLabels:{enabled:false},tooltip:{theme:c.am,y:{formatter:v=>'$'+v?.toLocaleString()+'M'}}});
        },

        // ── Compare ──
        async loadCompare(){if(!this.compareInput)return;this.compareLoading=true;try{this.compareData=await this.api(`/api/compare?symbols=${this.compareInput.toUpperCase().replace(/\s/g,'')}&period=${this.comparePeriod}`);this.$nextTick(()=>{this.renderCmpChart();this.renderCmpRadar()})}catch(e){}this.compareLoading=false},
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

        // ── Peer Comparison ──
        async loadPeers(s){
            if(!s)return;this.peerLoading=true;this.peerData=null;
            try{this.peerData=await this.api(`/api/peers/${s}`)}catch(e){}
            this.peerLoading=false;
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
            if(this.stockScore){rows.push([]);rows.push(['Health Score']);rows.push(['Overall',this.stockScore.overallScore]);rows.push(['Rating',this.stockScore.rating]);for(const cat of this.scoreCategories){if(this.stockScore.scores?.[cat.key]!=null)rows.push([cat.label,this.stockScore.scores[cat.key]])}}
            this._downloadCSV('analysis_'+d.symbol+'_'+new Date().toISOString().split('T')[0]+'.csv',rows);
        },

        // ── Apex ──
        renderApex(id,opts){if(typeof ApexCharts==='undefined')return;if(this.apex[id]){this.apex[id].destroy();delete this.apex[id]}const el=document.getElementById(id);if(!el)return;el.innerHTML='';const ch=new ApexCharts(el,opts);ch.render();this.apex[id]=ch},

        // ── Charting page ──────────────────────────────────────────────────
        async loadMetrics(sym){
            sym=(sym||'').trim().toUpperCase();
            if(!sym)return;
            this.chartingSymbol=sym; this.chartingInput=sym; this.chartError=''; this.metricsLoading=true; this.metricsData=null;
            try{
                const d=await this.api(`/api/metrics/${encodeURIComponent(sym)}?freq=${this.chartFreq}`);
                if(!d||d.error||!d.metrics||!Object.keys(d.metrics).length){
                    this.metricsData=null; this.chartingSymbol=''; this.chartError=`No financial data found for "${sym}".`;
                }else{
                    this.metricsData=d;
                    const avail=Object.keys(d.metrics);
                    this.selectedMetrics=this.selectedMetrics.filter(k=>avail.includes(k));
                    if(!this.selectedMetrics.length)this.selectedMetrics=['revenue','netMargin'].filter(k=>avail.includes(k));
                    if(!this.selectedMetrics.length)this.selectedMetrics=avail.slice(0,2);
                    this.$nextTick(()=>this.renderMetricChart());
                }
            }catch(e){ this.metricsData=null; this.chartingSymbol=''; this.chartError='Could not load data. Try again.'; }
            this.metricsLoading=false;
        },
        setChartFreq(f){ if(this.chartFreq===f)return; this.chartFreq=f; this.chartRange=99; if(this.chartingSymbol)this.loadMetrics(this.chartingSymbol); },
        setChartRange(n){ this.chartRange=n; this.$nextTick(()=>this.renderMetricChart()); },
        setOverlay(o){ this.chartOverlay=o; this.$nextTick(()=>this.renderMetricChart()); },
        toggleMetric(k){ const i=this.selectedMetrics.indexOf(k); if(i>=0)this.selectedMetrics.splice(i,1); else{ if(this.selectedMetrics.length>=4)return; this.selectedMetrics.push(k); } this.$nextTick(()=>this.renderMetricChart()); },
        chartRanges(){ return this.chartFreq==='annual'?[{l:'5Y',n:5},{l:'10Y',n:10},{l:'Max',n:99}]:[{l:'2Y',n:8},{l:'5Y',n:20},{l:'Max',n:99}]; },
        metricGroups(){
            const order=['Income Statement','Margins','Per Share','Returns','Liquidity & Leverage','Cash Flow','Valuation'];
            const m=this.metricsData?.metrics||{}, g={};
            Object.keys(m).forEach(k=>{(g[m[k].group]=g[m[k].group]||[]).push({key:k,label:m[k].label,unit:m[k].unit})});
            return order.filter(o=>g[o]).map(o=>({name:o,items:g[o]}));
        },
        _visStart(){ const p=this.metricsData?.periods||[]; return Math.max(0,p.length-this.chartRange); },
        fmtPeriod(d){ const y=d.slice(0,4); if(this.chartFreq==='annual')return "FY"+y.slice(2); const q=Math.floor((+d.slice(5,7)-1)/3)+1; return 'Q'+q+" '"+y.slice(2); },
        chartPeriodLabels(){ const p=this.metricsData?.periods||[]; return p.slice(this._visStart()).map(d=>this.fmtPeriod(d)); },
        _transform(key){ // returns {data, unit} after applying the active overlay transform
            const m=this.metricsData.metrics[key]; let data=m.data.slice(), unit=m.unit;
            if(this.chartOverlay==='yoy'){ const lag=this.chartFreq==='annual'?1:4; data=data.map((v,j)=>(v!=null&&data[j-lag]!=null&&data[j-lag]!==0)?+(((v-data[j-lag])/Math.abs(data[j-lag]))*100).toFixed(2):null); unit='%'; }
            return {data,unit};
        },
        chartSeriesData(key){ return this._transform(key).data.slice(this._visStart()); },
        fmtMetricVal(v,u){
            if(v==null||v===undefined)return '–';
            if(u==='$M'){ const a=Math.abs(v); if(a>=1e6)return (v/1e6).toFixed(2)+'T'; if(a>=1000)return '$'+(v/1000).toFixed(1)+'B'; return '$'+v.toFixed(0)+'M'; }
            if(u==='%')return v.toFixed(1)+'%';
            if(u==='x')return v.toFixed(2)+'×';
            if(u==='$')return '$'+v.toFixed(2);
            return (''+v);
        },
        renderMetricChart(){
            if(typeof ApexCharts==='undefined'||!this.metricsData)return;
            const keys=this.selectedMetrics.filter(k=>this.metricsData.metrics[k]);
            if(!keys.length){ if(this.apex['metric-chart']){this.apex['metric-chart'].destroy();delete this.apex['metric-chart'];} return; }
            const c=this.tc(), start=this._visStart(), labels=this.chartPeriodLabels();
            const sma=this.chartOverlay==='sma', win=this.chartFreq==='annual'?3:4;
            const series=[], colors=[];
            keys.forEach((k,i)=>{
                const t=this._transform(k), col=this.metricColors[i%this.metricColors.length];
                const type=(this.chartOverlay!=='yoy'&&t.unit==='$M')?'column':'line';
                series.push({name:this.metricsData.metrics[k].label+(this.chartOverlay==='yoy'?' YoY':''),type,data:t.data.slice(start),_unit:t.unit}); colors.push(col);
                if(sma){
                    const ma=t.data.map((_,j)=>{ if(j<win-1)return null; let s=0,n=0; for(let q=0;q<win;q++){const x=t.data[j-q]; if(x!=null){s+=x;n++;}} return n?+(s/n).toFixed(2):null; });
                    series.push({name:this.metricsData.metrics[k].label+' '+win+(this.chartFreq==='annual'?'y':'q')+' avg',type:'line',data:ma.slice(start),_unit:t.unit,_ma:true}); colors.push(col);
                }
            });
            const units=[...new Set(series.map(s=>s._unit))];
            const yaxis=units.map((u,ui)=>({seriesName:series.filter(s=>s._unit===u).map(s=>s.name),opposite:ui>0,labels:{style:{colors:c.at},formatter:v=>this.fmtMetricVal(v,u)},title:{text:u,style:{color:c.at,fontWeight:600,fontSize:'11px'}}}));
            const widths=series.map(s=>s.type==='line'?(s._ma?2:2.5):0);
            const dash=series.map(s=>s._ma?6:0);
            this.renderApex('metric-chart',{
                chart:{type:'line',height:430,background:'transparent',fontFamily:'Inter,system-ui,sans-serif',toolbar:{show:true,tools:{download:true,zoom:true,zoomin:true,zoomout:true,reset:true,pan:false,selection:false}},animations:{enabled:true,speed:400}},
                series,colors,
                stroke:{width:widths,curve:'straight',dashArray:dash},
                xaxis:{categories:labels,labels:{style:{colors:c.at,fontSize:'12px'}},axisBorder:{color:c.ag},axisTicks:{color:c.ag}},
                yaxis,
                plotOptions:{bar:{borderRadius:4,columnWidth:'55%'}},
                grid:{borderColor:c.ag,strokeDashArray:3,padding:{left:8,right:8}},
                theme:{mode:c.am},
                legend:{labels:{colors:c.at},position:'top',horizontalAlign:'left',fontSize:'12px',markers:{radius:3}},
                dataLabels:{enabled:false},
                markers:{size:3,strokeWidth:0,hover:{size:5}},
                tooltip:{theme:c.am,shared:true,intersect:false,y:{formatter:(v,o)=>this.fmtMetricVal(v,series[o.seriesIndex]?._unit)}},
                noData:{text:'No data',style:{color:c.at}}
            });
        },
    };
}
