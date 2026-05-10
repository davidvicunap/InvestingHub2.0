const API_BASE = 'https://investinghub.onrender.com';

// Logo URL helper - uses multiple sources for company logos
function getCompanyLogoUrl(symbol) {
    if (!symbol) return '';
    const clean = symbol.replace('^', '').replace('-USD', '').replace('=F', '');
    const domainMap = {
        'AAPL': 'apple.com', 'MSFT': 'microsoft.com', 'GOOGL': 'google.com', 'GOOG': 'google.com',
        'AMZN': 'amazon.com', 'META': 'meta.com', 'TSLA': 'tesla.com', 'NVDA': 'nvidia.com',
        'NFLX': 'netflix.com', 'DIS': 'disney.com', 'PYPL': 'paypal.com', 'INTC': 'intel.com',
        'AMD': 'amd.com', 'CRM': 'salesforce.com', 'ORCL': 'oracle.com', 'IBM': 'ibm.com',
        'CSCO': 'cisco.com', 'ADBE': 'adobe.com', 'SHOP': 'shopify.com', 'SQ': 'squareup.com',
        'SPOT': 'spotify.com', 'UBER': 'uber.com', 'LYFT': 'lyft.com', 'SNAP': 'snap.com',
        'TWTR': 'twitter.com', 'PINS': 'pinterest.com', 'ZM': 'zoom.us', 'DOCU': 'docusign.com',
        'WMT': 'walmart.com', 'TGT': 'target.com', 'HD': 'homedepot.com', 'LOW': 'lowes.com',
        'COST': 'costco.com', 'SBUX': 'starbucks.com', 'MCD': 'mcdonalds.com', 'NKE': 'nike.com',
        'KO': 'coca-cola.com', 'PEP': 'pepsico.com', 'JNJ': 'jnj.com', 'PFE': 'pfizer.com',
        'MRNA': 'modernatx.com', 'UNH': 'unitedhealthgroup.com', 'V': 'visa.com', 'MA': 'mastercard.com',
        'JPM': 'jpmorganchase.com', 'BAC': 'bankofamerica.com', 'GS': 'goldmansachs.com',
        'MS': 'morganstanley.com', 'WFC': 'wellsfargo.com', 'C': 'citigroup.com',
        'BA': 'boeing.com', 'XOM': 'exxonmobil.com', 'CVX': 'chevron.com',
        'BRK.B': 'berkshirehathaway.com', 'BRK-B': 'berkshirehathaway.com',
        'T': 'att.com', 'VZ': 'verizon.com', 'TMUS': 't-mobile.com',
        'F': 'ford.com', 'GM': 'gm.com', 'RIVN': 'rivian.com', 'LCID': 'lucidmotors.com',
        'COIN': 'coinbase.com', 'HOOD': 'robinhood.com', 'SOFI': 'sofi.com',
        'PLTR': 'palantir.com', 'SNOW': 'snowflake.com', 'CRWD': 'crowdstrike.com',
        'NET': 'cloudflare.com', 'DDOG': 'datadoghq.com', 'MDB': 'mongodb.com',
        'ABNB': 'airbnb.com', 'BKNG': 'booking.com', 'EXPE': 'expedia.com',
        'ARM': 'arm.com', 'AVGO': 'broadcom.com', 'QCOM': 'qualcomm.com',
        'TXN': 'ti.com', 'MU': 'micron.com', 'AMAT': 'appliedmaterials.com',
    };
    const domain = domainMap[clean.toUpperCase()];
    if (domain) {
        return `https://logo.clearbit.com/${domain}`;
    }
    return `https://logo.clearbit.com/${clean.toLowerCase()}.com`;
}

function app() {
    return {
        currentPage: 'dashboard',
        searchQuery: '',
        searchResults: [],
        showSearchDropdown: false,

        darkMode: true,

        // Auth
        authToken: localStorage.getItem('investorhub-token') || '',
        currentUser: JSON.parse(localStorage.getItem('investorhub-user') || 'null'),
        showLoginModal: false,
        showRegisterModal: false,
        authError: '',
        authLoading: false,
        loginForm: { email: '', password: '' },
        registerForm: { name: '', email: '', password: '' },

        navItems: [
            { id: 'dashboard', label: 'Dashboard', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>' },
            { id: 'news', label: 'News', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>' },
            { id: 'analysis', label: 'Analysis', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
            { id: 'compare', label: 'Compare', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>' },
            { id: 'portfolio', label: 'Portfolio', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>' },
        ],

        marketData: [],
        marketLoading: false,
        watchlist: [],
        watchlistLoading: false,

        // News
        marketNews: [],
        newsLoading: false,

        portfolio: [],
        portfolioLoading: false,
        showAddHolding: false,
        newHolding: { symbol: '', shares: '', buy_price: '', buy_date: '', notes: '' },

        analysisSymbol: '',
        analysisData: null,
        analysisStats: [],
        analysisLoading: false,
        analysisTab: 'Price Chart',
        chartPeriod: '1y',
        technicalPeriod: '1y',
        fundamentalsData: null,
        financialsTab: 'income',
        financialsPeriod: 'annual',

        // Stock Score
        stockScore: null,

        // Stock News
        stockNews: null,
        stockNewsLoading: false,

        compareInput: '',
        compareData: null,
        compareLoading: false,
        comparePeriod: '1y',
        compareColors: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'],
        compareMetrics: [
            { key: 'price', label: 'Price', format: 'price' },
            { key: 'marketCap', label: 'Market Cap', format: 'marketcap' },
            { key: 'peRatio', label: 'P/E Ratio', format: 'number' },
            { key: 'forwardPE', label: 'Forward P/E', format: 'number' },
            { key: 'eps', label: 'EPS', format: 'price' },
            { key: 'dividendYield', label: 'Dividend Yield', format: 'rawpercent', colorize: true },
            { key: 'beta', label: 'Beta', format: 'number' },
            { key: 'profitMargin', label: 'Profit Margin', format: 'percent', colorize: true },
            { key: 'returnOnEquity', label: 'Return on Equity', format: 'percent', colorize: true },
            { key: 'revenueGrowth', label: 'Revenue Growth', format: 'percent', colorize: true },
            { key: 'earningsGrowth', label: 'Earnings Growth', format: 'percent', colorize: true },
            { key: 'debtToEquity', label: 'Debt/Equity', format: 'number' },
            { key: 'fiftyTwoWeekHigh', label: '52W High', format: 'price' },
            { key: 'fiftyTwoWeekLow', label: '52W Low', format: 'price' },
            { key: 'sector', label: 'Sector', format: 'text' },
            { key: 'industry', label: 'Industry', format: 'text' },
        ],

        apexCharts: {},
        tvCharts: {},

        async init() {
            const saved = localStorage.getItem('investorhub-theme');
            if (saved) {
                this.darkMode = saved === 'dark';
            } else {
                this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
            this.applyTheme();

            this.loadMarketData();
            this.loadWatchlist();
            this.loadPortfolio();
        },

        // -- Auth Methods --------------------------------------------------------
        getAuthHeaders() {
            if (!this.authToken) return {};
            return { 'Authorization': `Bearer ${this.authToken}` };
        },

        async login() {
            this.authError = '';
            this.authLoading = true;
            try {
                const resp = await fetch(API_BASE + '/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.loginForm),
                });
                const data = await resp.json();
                if (!resp.ok) {
                    this.authError = data.error || 'Login failed';
                    this.authLoading = false;
                    return;
                }
                this.authToken = data.token;
                this.currentUser = data.user;
                localStorage.setItem('investorhub-token', data.token);
                localStorage.setItem('investorhub-user', JSON.stringify(data.user));
                this.showLoginModal = false;
                this.loginForm = { email: '', password: '' };
                this.loadPortfolio();
                this.loadWatchlist();
            } catch (e) {
                this.authError = 'Connection error. Please try again.';
            }
            this.authLoading = false;
        },

        async register() {
            this.authError = '';
            this.authLoading = true;
            try {
                const resp = await fetch(API_BASE + '/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.registerForm),
                });
                const data = await resp.json();
                if (!resp.ok) {
                    this.authError = data.error || 'Registration failed';
                    this.authLoading = false;
                    return;
                }
                this.authToken = data.token;
                this.currentUser = data.user;
                localStorage.setItem('investorhub-token', data.token);
                localStorage.setItem('investorhub-user', JSON.stringify(data.user));
                this.showRegisterModal = false;
                this.registerForm = { name: '', email: '', password: '' };
                this.loadPortfolio();
                this.loadWatchlist();
            } catch (e) {
                this.authError = 'Connection error. Please try again.';
            }
            this.authLoading = false;
        },

        logout() {
            this.authToken = '';
            this.currentUser = null;
            localStorage.removeItem('investorhub-token');
            localStorage.removeItem('investorhub-user');
            this.portfolio = [];
            this.watchlist = [];
            this.loadWatchlist();
            this.loadPortfolio();
        },

        // -- Theme ---------------------------------------------------------------
        toggleTheme() {
            this.darkMode = !this.darkMode;
            this.applyTheme();
            localStorage.setItem('investorhub-theme', this.darkMode ? 'dark' : 'light');
            this.reRenderVisibleCharts();
        },

        applyTheme() {
            document.documentElement.classList.toggle('dark', this.darkMode);
        },

        themeColors() {
            return this.darkMode ? {
                bg: '#111827', grid: '#1e293b', text: '#94a3b8', cross: '#64748b',
                border: '#334155', upColor: '#10b981', downColor: '#ef4444',
                volUp: 'rgba(16,185,129,0.25)', volDown: 'rgba(239,68,68,0.25)',
                lineMain: '#e2e8f0', apexMode: 'dark',
                apexGrid: '#1e293b', apexText: '#94a3b8', apexStroke: '#334155',
            } : {
                bg: '#ffffff', grid: '#f1f5f9', text: '#64748b', cross: '#94a3b8',
                border: '#e2e8f0', upColor: '#10b981', downColor: '#ef4444',
                volUp: 'rgba(16,185,129,0.3)', volDown: 'rgba(239,68,68,0.3)',
                lineMain: '#334155', apexMode: 'light',
                apexGrid: '#f1f5f9', apexText: '#64748b', apexStroke: '#e2e8f0',
            };
        },

        reRenderVisibleCharts() {
            if (this.currentPage === 'analysis' && this.analysisData) {
                if (this.analysisTab === 'Price Chart') this.loadPriceChart(this.analysisData.symbol);
                if (this.analysisTab === 'Technicals') this.loadTechnicals(this.analysisData.symbol);
                if (this.analysisTab === 'Fundamentals' && this.fundamentalsData) this.renderFundamentalsCharts();
            }
            if (this.currentPage === 'compare' && this.compareData) this.renderCompareChart();
            if (this.portfolio.length > 0) this.renderPortfolioCharts();
        },

        navigate(page) {
            this.currentPage = page;
            if (page === 'dashboard') {
                this.loadMarketData();
                this.loadWatchlist();
                this.loadPortfolio();
            }
            if (page === 'news' && this.marketNews.length === 0) {
                this.loadMarketNews();
            }
            if (page === 'portfolio') {
                this.$nextTick(() => { if (this.portfolio.length > 0) this.renderPortfolioCharts(); });
            }
        },

        selectStock(symbol) {
            if (!symbol) return;
            this.analysisSymbol = symbol;
            this.currentPage = 'analysis';
            this.loadAnalysis(symbol);
        },

        switchAnalysisTab(tab) {
            this.analysisTab = tab;
            this.$nextTick(() => {
                if (tab === 'Technicals') this.loadTechnicals(this.analysisData?.symbol);
                if (tab === 'Fundamentals' && this.fundamentalsData) this.renderFundamentalsCharts();
                if (tab === 'News' && !this.stockNews) this.loadStockNews(this.analysisData?.symbol);
            });
        },

        // -- Logo Helper ---------------------------------------------------------
        getLogoUrl(symbol) {
            return getCompanyLogoUrl(symbol);
        },

        // -- Score Color Helper --------------------------------------------------
        getScoreColor(score) {
            if (score >= 7) return '#10b981';
            if (score >= 5) return '#f59e0b';
            return '#ef4444';
        },

        // -- Formatting ----------------------------------------------------------
        formatPrice(val) {
            if (!val && val !== 0) return '—';
            return '$' + parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },

        formatLargeNumber(val) {
            if (!val) return '—';
            const n = parseFloat(val);
            if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
            if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
            if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
            return '$' + n.toLocaleString();
        },

        formatPercent(val) {
            if (!val && val !== 0) return '—';
            return (parseFloat(val) * 100).toFixed(2) + '%';
        },

        formatRawPercent(val) {
            if (!val && val !== 0) return '—';
            return parseFloat(val).toFixed(2) + '%';
        },

        formatMetric(val, format) {
            if (val === undefined || val === null) return '—';
            if (format === 'price') return this.formatPrice(val);
            if (format === 'marketcap') return this.formatLargeNumber(val);
            if (format === 'percent') return this.formatPercent(val);
            if (format === 'rawpercent') return this.formatRawPercent(val);
            if (format === 'number') return parseFloat(val).toFixed(2);
            if (format === 'text') return val || '—';
            return val;
        },

        getMetricColor(val) {
            if (!val && val !== 0) return 'th-heading';
            return parseFloat(val) >= 0 ? 'text-emerald-500' : 'text-red-500';
        },

        formatNewsDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp * 1000);
            const now = new Date();
            const diff = (now - date) / 1000;
            if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },

        // -- API helpers ---------------------------------------------------------
        async fetchJson(url) {
            const headers = this.getAuthHeaders();
            const resp = await fetch(API_BASE + url, { headers });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return resp.json();
        },

        async postJson(url, data) {
            const headers = { 'Content-Type': 'application/json', ...this.getAuthHeaders() };
            const resp = await fetch(API_BASE + url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data),
            });
            return resp.json();
        },

        async deleteJson(url) {
            const headers = this.getAuthHeaders();
            await fetch(API_BASE + url, { method: 'DELETE', headers });
        },

        // -- Search -----------------------------------------------------------
        async searchStocks() {
            if (this.searchQuery.length < 1) {
                this.searchResults = [];
                this.showSearchDropdown = false;
                return;
            }
            try {
                const res = await this.fetchJson(`/api/search?q=${encodeURIComponent(this.searchQuery)}`);
                this.searchResults = Array.isArray(res) ? res : [];
                this.showSearchDropdown = this.searchResults.length > 0;
            } catch (e) {
                this.searchResults = [];
                this.showSearchDropdown = false;
            }
        },

        // -- Market Data ------------------------------------------------------
        async loadMarketData() {
            this.marketLoading = true;
            try { this.marketData = await this.fetchJson('/api/market'); }
            catch (e) { console.error(e); }
            this.marketLoading = false;
        },

        // -- Market News ---------------------------------------------------------
        async loadMarketNews() {
            this.newsLoading = true;
            try {
                const data = await this.fetchJson('/api/market-news');
                this.marketNews = data.news || [];
            } catch (e) { console.error(e); }
            this.newsLoading = false;
        },

        // -- Stock News -----------------------------------------------------------
        async loadStockNews(symbol) {
            if (!symbol) return;
            this.stockNewsLoading = true;
            try {
                this.stockNews = await this.fetchJson(`/api/news/${symbol}`);
            } catch (e) { console.error(e); }
            this.stockNewsLoading = false;
        },

        // -- Watchlist --------------------------------------------------------
        async loadWatchlist() {
            this.watchlistLoading = true;
            try { this.watchlist = await this.fetchJson('/api/watchlist'); }
            catch (e) { console.error(e); }
            this.watchlistLoading = false;
        },

        async addToWatchlist(symbol) {
            if (!symbol) return;
            await this.postJson('/api/watchlist', { symbol: symbol.toUpperCase() });
            this.loadWatchlist();
        },

        async removeFromWatchlist(symbol) {
            await this.deleteJson(`/api/watchlist/${symbol}`);
            this.loadWatchlist();
        },

        // -- Portfolio --------------------------------------------------------
        async loadPortfolio() {
            this.portfolioLoading = true;
            try {
                this.portfolio = await this.fetchJson('/api/portfolio');
                if (this.currentPage === 'dashboard' || this.currentPage === 'portfolio') {
                    this.$nextTick(() => { if (this.portfolio.length > 0) this.renderPortfolioCharts(); });
                }
            } catch (e) { console.error(e); }
            this.portfolioLoading = false;
        },

        async addHolding() {
            if (!this.newHolding.symbol || !this.newHolding.shares || !this.newHolding.buy_price) return;
            await this.postJson('/api/portfolio', this.newHolding);
            this.newHolding = { symbol: '', shares: '', buy_price: '', buy_date: '', notes: '' };
            this.showAddHolding = false;
            this.loadPortfolio();
        },

        async deleteHolding(id) {
            await this.deleteJson(`/api/portfolio/${id}`);
            this.loadPortfolio();
        },

        holdingPL(h) { return ((h.currentPrice || 0) - h.buy_price) * h.shares; },
        holdingReturn(h) { return h.buy_price ? (((h.currentPrice || 0) - h.buy_price) / h.buy_price) * 100 : 0; },
        holdingWeight(h) { const t = this.portfolioTotalValue(); return t ? ((h.currentPrice || 0) * h.shares / t) * 100 : 0; },
        portfolioTotalValue() { return this.portfolio.reduce((s, h) => s + (h.currentPrice || 0) * h.shares, 0); },
        portfolioTotalCost() { return this.portfolio.reduce((s, h) => s + h.buy_price * h.shares, 0); },
        portfolioTotalPL() { return this.portfolioTotalValue() - this.portfolioTotalCost(); },
        portfolioTotalReturn() { const c = this.portfolioTotalCost(); return c ? ((this.portfolioTotalValue() - c) / c) * 100 : 0; },

        renderPortfolioCharts() {
            if (!this.portfolio.length) return;
            const c = this.themeColors();
            const labels = this.portfolio.map(h => h.symbol);
            const values = this.portfolio.map(h => Math.round((h.currentPrice || 0) * h.shares * 100) / 100);

            const pieOpts = (id, height) => ({
                chart: { type: 'donut', height, background: 'transparent' },
                series: values, labels,
                colors: ['#6366f1','#06b6d4','#f59e0b','#ef4444','#10b981','#8b5cf6','#f97316','#ec4899'],
                theme: { mode: c.apexMode },
                plotOptions: { pie: { donut: { size: '65%', labels: { show: true, name: { color: c.apexText }, value: { color: c.apexText, formatter: v => '$' + parseFloat(v).toLocaleString() }, total: { show: true, color: c.apexText, label: 'Total', formatter: w => '$' + w.globals.seriesTotals.reduce((a,b) => a+b, 0).toLocaleString() } } } } },
                legend: { position: 'bottom', labels: { colors: c.apexText } },
                stroke: { colors: [c.bg] },
                dataLabels: { enabled: false },
            });

            if (this.currentPage === 'portfolio' || this.currentPage === 'dashboard') {
                if (document.getElementById('portfolio-allocation-chart')) this.renderApex('portfolio-allocation-chart', pieOpts('alloc', 280));
                if (document.getElementById('portfolio-pie-chart')) this.renderApex('portfolio-pie-chart', { ...pieOpts('dash', 200), plotOptions: { pie: { donut: { size: '70%' } } } });
            }

            const plValues = this.portfolio.map(h => Math.round(this.holdingPL(h) * 100) / 100);
            const barColors = plValues.map(v => v >= 0 ? '#10b981' : '#ef4444');
            if (document.getElementById('portfolio-performance-chart')) {
                this.renderApex('portfolio-performance-chart', {
                    chart: { type: 'bar', height: 280, background: 'transparent', toolbar: { show: false } },
                    series: [{ name: 'P&L', data: plValues }],
                    xaxis: { categories: labels, labels: { style: { colors: c.apexText } } },
                    yaxis: { labels: { style: { colors: c.apexText }, formatter: v => '$' + v.toLocaleString() } },
                    colors: barColors,
                    plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: '55%' } },
                    theme: { mode: c.apexMode },
                    grid: { borderColor: c.apexGrid, strokeDashArray: 3 },
                    legend: { show: false },
                    dataLabels: { enabled: false },
                    tooltip: { theme: c.apexMode, y: { formatter: v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2 }) } },
                });
            }
        },

        // -- Analysis ---------------------------------------------------------
        async loadAnalysis(symbol) {
            if (!symbol) return;
            symbol = symbol.toUpperCase().trim();
            this.analysisSymbol = symbol;
            this.analysisLoading = true;
            this.analysisData = null;
            this.analysisStats = [];
            this.fundamentalsData = null;
            this.stockScore = null;
            this.stockNews = null;
            this.analysisTab = 'Price Chart';

            try {
                const data = await this.fetchJson(`/api/quote/${symbol}`);
                this.analysisData = data;

                this.analysisStats = [
                    { label: 'Market Cap', value: this.formatLargeNumber(data.marketCap) },
                    { label: 'P/E Ratio', value: data.peRatio ? data.peRatio.toFixed(2) : '—' },
                    { label: 'Forward P/E', value: data.forwardPE ? data.forwardPE.toFixed(2) : '—' },
                    { label: 'EPS', value: data.eps ? '$' + data.eps.toFixed(2) : '—' },
                    { label: 'Div Yield', value: data.dividendYield ? data.dividendYield.toFixed(2) + '%' : '—' },
                    { label: 'Beta', value: data.beta ? data.beta.toFixed(2) : '—' },
                    { label: '52W High', value: this.formatPrice(data.fiftyTwoWeekHigh) },
                    { label: '52W Low', value: this.formatPrice(data.fiftyTwoWeekLow) },
                    { label: '50D Avg', value: this.formatPrice(data.fiftyDayAvg) },
                    { label: '200D Avg', value: this.formatPrice(data.twoHundredDayAvg) },
                    { label: 'Volume', value: data.volume ? data.volume.toLocaleString() : '—' },
                    { label: 'Avg Volume', value: data.avgVolume ? data.avgVolume.toLocaleString() : '—' },
                    { label: 'Profit Margin', value: data.profitMargin ? (data.profitMargin * 100).toFixed(2) + '%' : '—' },
                    { label: 'ROE', value: data.returnOnEquity ? (data.returnOnEquity * 100).toFixed(2) + '%' : '—' },
                    { label: 'Revenue', value: this.formatLargeNumber(data.revenue) },
                    { label: 'EBITDA', value: this.formatLargeNumber(data.ebitda) },
                    { label: 'Free Cash Flow', value: this.formatLargeNumber(data.freeCashflow) },
                    { label: 'Debt/Equity', value: data.debtToEquity ? data.debtToEquity.toFixed(2) : '—' },
                ];

                this.$nextTick(() => this.loadPriceChart(symbol));
                this.fetchFundamentals(symbol);
                this.fetchStockScore(symbol);
            } catch (e) { console.error(e); }
            this.analysisLoading = false;
        },

        async fetchFundamentals(symbol) {
            try {
                this.fundamentalsData = await this.fetchJson(`/api/fundamentals/${symbol}`);
            } catch (e) { console.error(e); }
        },

        async fetchStockScore(symbol) {
            try {
                this.stockScore = await this.fetchJson(`/api/score/${symbol}`);
            } catch (e) { console.error(e); }
        },

        // -- Financial Statements ---------------------------------------------
        getFinancialData() {
            if (!this.fundamentalsData) return {};
            const map = {
                'income-annual': 'financials',
                'income-quarterly': 'quarterlyFinancials',
                'balance-annual': 'balanceSheet',
                'balance-quarterly': 'quarterlyBalanceSheet',
                'cashflow-annual': 'cashflow',
                'cashflow-quarterly': 'quarterlyCashflow',
            };
            return this.fundamentalsData[map[`${this.financialsTab}-${this.financialsPeriod}`]] || {};
        },

        getFinancialDates() {
            return Object.keys(this.getFinancialData()).sort().reverse();
        },

        _statementOrders() {
            return {
                income: [
                    '#Revenue','*Total Revenue','Operating Revenue','Cost Of Revenue','*Gross Profit',
                    '#Operating Expenses','Research And Development','Selling General And Administration','Operating Expense','Total Expenses','*Operating Income','*EBIT',
                    '#Other Income / Expense','Interest Income','Interest Expense','Net Non Operating Interest Income Expense','Other Income Expense',
                    '#Income Before Tax','*Pretax Income','Tax Provision',
                    '#Net Income','*Net Income','Net Income Common Stockholders','Diluted NI Availto Com Stockholders',
                    '#EBITDA','*EBITDA','Normalized EBITDA','Reconciled Depreciation',
                    '#Per Share','Basic EPS','Diluted EPS','Basic Average Shares','Diluted Average Shares',
                ],
                balance: [
                    '#Current Assets','Cash And Cash Equivalents','Other Short Term Investments','Accounts Receivable','Inventory','Other Current Assets','*Current Assets',
                    '#Non-Current Assets','Net PPE','Goodwill And Other Intangible Assets','Other Non Current Assets','*Total Non Current Assets',
                    '#Total Assets','*Total Assets',
                    '#Current Liabilities','Accounts Payable','Current Debt','Other Current Liabilities','*Current Liabilities',
                    '#Non-Current Liabilities','Long Term Debt','Other Non Current Liabilities','*Total Non Current Liabilities Net Minority Interest',
                    '#Total Liabilities','*Total Liabilities Net Minority Interest',
                    '#Equity','Common Stock','Retained Earnings','Treasury Stock','*Stockholders Equity','*Total Equity Gross Minority Interest',
                    '#Supplemental','Net Debt','Total Debt','Working Capital','Share Issued',
                ],
                cashflow: [
                    '#Operating Activities','Net Income From Continuing Operations','Depreciation And Amortization','Stock Based Compensation','Change In Working Capital','*Operating Cash Flow',
                    '#Investing Activities','Capital Expenditure','Net Investment Purchase And Sale','*Investing Cash Flow',
                    '#Financing Activities','Net Common Stock Issuance','Net Issuance Payments Of Debt','Cash Dividends Paid','*Financing Cash Flow',
                    '#Net Change','Changes In Cash','Beginning Cash Position','End Cash Position','*Free Cash Flow',
                ],
            };
        },

        getFinancialLineItems() {
            const data = this.getFinancialData();
            const dates = this.getFinancialDates();
            if (!dates.length) return [];

            const available = new Set();
            for (const date of dates) {
                for (const key of Object.keys(data[date] || {})) available.add(key);
            }

            const order = (this._statementOrders()[this.financialsTab] || []);
            const used = new Set();
            const result = [];
            let pendingHeader = null;

            for (const entry of order) {
                if (entry.startsWith('#')) { pendingHeader = entry.slice(1); continue; }
                const bold = entry.startsWith('*');
                const key = bold ? entry.slice(1) : entry;
                if (available.has(key)) {
                    if (pendingHeader) { result.push({ id: 'h_' + pendingHeader, type: 'header', label: pendingHeader }); pendingHeader = null; }
                    result.push({ id: 'i_' + key, type: 'item', key, label: key, bold });
                    used.add(key);
                }
            }

            const remaining = [...available].filter(k => !used.has(k)).sort();
            if (remaining.length) {
                result.push({ id: 'h_other', type: 'header', label: 'Other' });
                for (const key of remaining) { result.push({ id: 'i_' + key, type: 'item', key, label: key, bold: false }); }
            }

            return result;
        },

        getFinancialValue(item, date) {
            return this.getFinancialData()[date]?.[item] ?? null;
        },

        formatStatementValue(val, lineItem) {
            if (val === null || val === undefined) return '—';
            const num = parseFloat(val);
            if (isNaN(num)) return '—';
            const isPerShare = lineItem && (lineItem.includes('EPS') || lineItem.includes('Per Share'));
            if (isPerShare) { return num < 0 ? `(${Math.abs(num).toFixed(2)})` : num.toFixed(2); }
            const abs = Math.abs(num);
            if (abs >= 1e6) { const m = Math.round(num / 1e6); return m < 0 ? `(${Math.abs(m).toLocaleString()})` : m.toLocaleString(); }
            return num < 0 ? `(${Math.abs(num).toFixed(2)})` : num.toFixed(2);
        },

        formatFinancialDate(dateStr) {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        },

        secEdgarUrl(symbol, formType) {
            const s = (symbol || '').replace('^', '');
            if (formType) { return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${s}&type=${formType}&dateb=&owner=include&count=20`; }
            return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${s}&type=&dateb=&owner=include&count=40`;
        },

        // -- TradingView Chart Helpers ----------------------------------------
        createTvChart(containerId, height) {
            this.destroyTvChart(containerId);
            const el = document.getElementById(containerId);
            if (!el) return null;
            el.innerHTML = '';
            const c = this.themeColors();
            const chart = LightweightCharts.createChart(el, {
                width: el.clientWidth, height: height || 400,
                layout: { background: { type: 'solid', color: c.bg }, textColor: c.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 },
                grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
                crosshair: { mode: LightweightCharts.CrosshairMode.Normal, vertLine: { color: c.cross, width: 1, style: 3 }, horzLine: { color: c.cross, width: 1, style: 3 } },
                rightPriceScale: { borderColor: c.border },
                timeScale: { borderColor: c.border, timeVisible: false },
                handleScroll: { vertTouchDrag: false },
            });
            const ro = new ResizeObserver(entries => { for (const e of entries) chart.applyOptions({ width: e.contentRect.width }); });
            ro.observe(el);
            this.tvCharts[containerId] = { chart, ro };
            return chart;
        },

        destroyTvChart(id) {
            const entry = this.tvCharts[id];
            if (entry) { entry.ro.disconnect(); entry.chart.remove(); delete this.tvCharts[id]; }
        },

        // -- Price Chart ------------------------------------------------------
        async loadPriceChart(symbol) {
            if (!symbol) symbol = this.analysisData?.symbol;
            if (!symbol) return;
            try {
                const data = await this.fetchJson(`/api/history/${symbol}?period=${this.chartPeriod}`);
                if (!data || data.error) return;
                const c = this.themeColors();
                const chart = this.createTvChart('tv-price-chart', 420);
                if (!chart) return;

                const candle = chart.addCandlestickSeries({ upColor: c.upColor, downColor: c.downColor, borderUpColor: c.upColor, borderDownColor: c.downColor, wickUpColor: c.upColor, wickDownColor: c.downColor });
                candle.setData(data.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })));

                const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
                chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
                vol.setData(data.map(d => ({ time: d.date, value: d.volume, color: d.close >= d.open ? c.volUp : c.volDown })));

                chart.timeScale().fitContent();
            } catch (e) { console.error(e); }
        },

        // -- Technicals -------------------------------------------------------
        async loadTechnicals(symbol) {
            if (!symbol) symbol = this.analysisData?.symbol;
            if (!symbol) return;
            try {
                const data = await this.fetchJson(`/api/technicals/${symbol}?period=${this.technicalPeriod}`);
                if (!data || data.error) return;
                const c = this.themeColors();

                const maChart = this.createTvChart('tv-tech-ma', 360);
                if (maChart) {
                    const closeSeries = maChart.addLineSeries({ color: c.lineMain, lineWidth: 2, title: 'Close' });
                    const sma20 = maChart.addLineSeries({ color: '#6366f1', lineWidth: 1.5, title: 'SMA 20' });
                    const sma50 = maChart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, title: 'SMA 50' });
                    const bbUp = maChart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: 2, title: 'BB Upper' });
                    const bbLo = maChart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: 2, title: 'BB Lower' });
                    closeSeries.setData(data.filter(d => d.Close != null).map(d => ({ time: d.date, value: d.Close })));
                    sma20.setData(data.filter(d => d.SMA20 != null).map(d => ({ time: d.date, value: d.SMA20 })));
                    sma50.setData(data.filter(d => d.SMA50 != null).map(d => ({ time: d.date, value: d.SMA50 })));
                    bbUp.setData(data.filter(d => d.BB_Upper != null).map(d => ({ time: d.date, value: d.BB_Upper })));
                    bbLo.setData(data.filter(d => d.BB_Lower != null).map(d => ({ time: d.date, value: d.BB_Lower })));
                    maChart.timeScale().fitContent();
                }

                const rsiChart = this.createTvChart('tv-tech-rsi', 220);
                if (rsiChart) {
                    const rsiLine = rsiChart.addLineSeries({ color: '#8b5cf6', lineWidth: 2, title: 'RSI', priceFormat: { type: 'custom', formatter: v => v.toFixed(1) } });
                    rsiLine.setData(data.filter(d => d.RSI != null).map(d => ({ time: d.date, value: d.RSI })));
                    rsiLine.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Overbought' });
                    rsiLine.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Oversold' });
                    rsiChart.priceScale('right').applyOptions({ autoScale: false, scaleMargins: { top: 0.05, bottom: 0.05 } });
                    rsiChart.timeScale().fitContent();
                }

                const macdChart = this.createTvChart('tv-tech-macd', 220);
                if (macdChart) {
                    const macdLine = macdChart.addLineSeries({ color: '#6366f1', lineWidth: 2, title: 'MACD' });
                    const signalLine = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, title: 'Signal' });
                    const hist = macdChart.addHistogramSeries({ title: 'Histogram', priceFormat: { type: 'custom', formatter: v => v.toFixed(3) } });
                    macdLine.setData(data.filter(d => d.MACD != null).map(d => ({ time: d.date, value: d.MACD })));
                    signalLine.setData(data.filter(d => d.Signal != null).map(d => ({ time: d.date, value: d.Signal })));
                    hist.setData(data.filter(d => d.MACD_Hist != null).map(d => ({ time: d.date, value: d.MACD_Hist, color: d.MACD_Hist >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)' })));
                    macdChart.timeScale().fitContent();
                }
            } catch (e) { console.error(e); }
        },

        // -- Fundamentals Charts ----------------------------------------------
        renderFundamentalsCharts() {
            if (!this.fundamentalsData) return;
            const data = this.fundamentalsData;
            const c = this.themeColors();

            const finDates = Object.keys(data.financials || {}).sort();
            const years = finDates.map(d => d.substring(0, 4));
            const revenue = finDates.map(d => { const v = data.financials[d]?.['Total Revenue']; return v ? Math.round(v / 1e6) : 0; });
            const netIncome = finDates.map(d => { const v = data.financials[d]?.['Net Income']; return v ? Math.round(v / 1e6) : 0; });

            this.renderApex('fund-revenue-chart', {
                chart: { type: 'bar', height: 300, background: 'transparent', toolbar: { show: false } },
                series: [{ name: 'Revenue ($M)', data: revenue }, { name: 'Net Income ($M)', data: netIncome }],
                xaxis: { categories: years, labels: { style: { colors: c.apexText } } },
                yaxis: { labels: { style: { colors: c.apexText }, formatter: v => '$' + v.toLocaleString() + 'M' } },
                colors: ['#6366f1', '#10b981'],
                plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
                grid: { borderColor: c.apexGrid, strokeDashArray: 3 },
                theme: { mode: c.apexMode },
                legend: { labels: { colors: c.apexText } },
                dataLabels: { enabled: false },
                tooltip: { theme: c.apexMode, y: { formatter: v => '$' + v?.toLocaleString() + 'M' } },
            });

            const grossM = finDates.map(d => { const gp = data.financials[d]?.['Gross Profit']; const rev = data.financials[d]?.['Total Revenue']; return gp && rev ? Math.round(gp / rev * 10000) / 100 : 0; });
            const opM = finDates.map(d => { const oi = data.financials[d]?.['Operating Income']; const rev = data.financials[d]?.['Total Revenue']; return oi && rev ? Math.round(oi / rev * 10000) / 100 : 0; });
            const netM = finDates.map(d => { const ni = data.financials[d]?.['Net Income']; const rev = data.financials[d]?.['Total Revenue']; return ni && rev ? Math.round(ni / rev * 10000) / 100 : 0; });

            this.renderApex('fund-margins-chart', {
                chart: { type: 'line', height: 300, background: 'transparent', toolbar: { show: false } },
                series: [{ name: 'Gross Margin', data: grossM }, { name: 'Operating Margin', data: opM }, { name: 'Net Margin', data: netM }],
                xaxis: { categories: years, labels: { style: { colors: c.apexText } } },
                yaxis: { labels: { style: { colors: c.apexText }, formatter: v => v.toFixed(1) + '%' } },
                colors: ['#6366f1', '#f59e0b', '#10b981'],
                stroke: { width: 2.5, curve: 'smooth' },
                markers: { size: 5 },
                grid: { borderColor: c.apexGrid, strokeDashArray: 3 },
                theme: { mode: c.apexMode },
                legend: { labels: { colors: c.apexText } },
                tooltip: { theme: c.apexMode, y: { formatter: v => v?.toFixed(2) + '%' } },
            });

            const cfDates = Object.keys(data.cashflow || {}).sort();
            const cfYears = cfDates.map(d => d.substring(0, 4));
            const opCF = cfDates.map(d => { const v = data.cashflow[d]?.['Operating Cash Flow']; return v ? Math.round(v / 1e6) : 0; });
            const capex = cfDates.map(d => { const v = data.cashflow[d]?.['Capital Expenditure']; return v ? Math.round(v / 1e6) : 0; });
            const fcf = cfDates.map((d, i) => opCF[i] + capex[i]);

            this.renderApex('fund-cashflow-chart', {
                chart: { type: 'bar', height: 300, background: 'transparent', toolbar: { show: false } },
                series: [{ name: 'Operating CF ($M)', data: opCF }, { name: 'CapEx ($M)', data: capex }, { name: 'Free CF ($M)', data: fcf }],
                xaxis: { categories: cfYears, labels: { style: { colors: c.apexText } } },
                yaxis: { labels: { style: { colors: c.apexText }, formatter: v => '$' + v.toLocaleString() + 'M' } },
                colors: ['#6366f1', '#ef4444', '#10b981'],
                plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
                grid: { borderColor: c.apexGrid, strokeDashArray: 3 },
                theme: { mode: c.apexMode },
                legend: { labels: { colors: c.apexText } },
                dataLabels: { enabled: false },
                tooltip: { theme: c.apexMode, y: { formatter: v => '$' + v?.toLocaleString() + 'M' } },
            });
        },

        // -- Compare ----------------------------------------------------------
        async loadComparison() {
            if (!this.compareInput) return;
            this.compareLoading = true;
            try {
                const symbols = this.compareInput.toUpperCase().replace(/\s/g, '');
                this.compareData = await this.fetchJson(`/api/compare?symbols=${symbols}&period=${this.comparePeriod}`);
                this.$nextTick(() => this.renderCompareChart());
            } catch (e) { console.error(e); }
            this.compareLoading = false;
        },

        renderCompareChart() {
            if (!this.compareData) return;
            const c = this.themeColors();
            const chart = this.createTvChart('tv-compare-chart', 400);
            if (!chart) return;
            const syms = Object.keys(this.compareData);
            syms.forEach((sym, i) => {
                const prices = this.compareData[sym]?.prices || [];
                if (!prices.length) return;
                const line = chart.addLineSeries({ color: this.compareColors[i % this.compareColors.length], lineWidth: 2, title: sym, priceFormat: { type: 'custom', formatter: v => v.toFixed(1) } });
                line.setData(prices.map(p => ({ time: p.date, value: p.normalized })));
            });
            chart.timeScale().fitContent();
        },

        // -- ApexCharts -------------------------------------------------------
        renderApex(elementId, options) {
            if (this.apexCharts[elementId]) { this.apexCharts[elementId].destroy(); delete this.apexCharts[elementId]; }
            const el = document.getElementById(elementId);
            if (!el) return;
            el.innerHTML = '';
            const chart = new ApexCharts(el, options);
            chart.render();
            this.apexCharts[elementId] = chart;
        },
    };
}
