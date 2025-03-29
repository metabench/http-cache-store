const DB_Record_Base = require('./DB_Record_Base');

class DB_URL_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.url_id = options.url_id;
        this.scheme = (options.scheme || 'http').toLowerCase();
        this.domain = options.domain ? options.domain.trim() : null;
        this.port = options.port;
        // Ensure the path starts with '/'.
        this.path = options.path ? (options.path.startsWith('/') ? options.path : '/' + options.path) : '/';
        this.querystring = options.querystring;
        this.fragment = options.fragment;
        this.full_url = options.full_url;

        if (!this.full_url && this.domain) {
            this.constructFullURL();
        }
    }

    constructFullURL() {
        const port = this.port ? `:${this.port}` : '';
        const query = this.querystring ? `?${this.querystring}` : '';
        const fragment = this.fragment ? `#${this.fragment}` : '';
        this.full_url = `${this.scheme}://${this.domain}${port}${this.path}${query}${fragment}`;
    }

    parseFromURL(url) {
        try {
            const parsed = new URL(url);
            this.scheme = parsed.protocol.replace(':', '').toLowerCase();
            this.domain = parsed.hostname;
            this.port = parsed.port || null;
            this.path = parsed.pathname;
            this.querystring = parsed.search.replace('?', '') || null;
            this.fragment = parsed.hash.replace('#', '') || null;
            this.full_url = url;
        } catch (error) {
            throw new Error(`Invalid URL: ${error.message}`);
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            url_id: this.url_id,
            scheme: this.scheme,
            domain: this.domain,
            port: this.port,
            path: this.path,
            querystring: this.querystring,
            fragment: this.fragment,
            full_url: this.full_url
        };
    }
}

module.exports = DB_URL_Record;
