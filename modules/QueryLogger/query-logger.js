const CONFIG = {
    RECAPTCHA_SITE_KEY: '6LcrZMQrAAAAABr2uYU5F53pEG46ZnU4LYxXXzWH',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby1aQG3ih1BOvPrpwF2v1RtfY8ZtA4TPWhsXuxhEOqNlYphr8RyIlgpsEJa_3nYj23V/exec',
    ALLOWED_ORIGINS: ['https://brahmoon.github.io']
};

function loadReCaptcha(siteKey) {
    return new Promise((resolve, reject) => {
        if (window.grecaptcha) return resolve(window.grecaptcha);
        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
        script.async = true;
        script.onload = () => resolve(window.grecaptcha);
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function parseQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    const appName = path.substring(0, path.lastIndexOf('/')).split('/').pop();
  
    return {
        code: params.get('code'),
        app_name: appName,
        game_id: params.get('game_id'),
        char_id: params.get('char_id')
    };
}

function validateParams(params) {
    return params.app_name && params.char_id;
}

async function getReCaptchaToken() {
    return await grecaptcha.execute(CONFIG.RECAPTCHA_SITE_KEY, { action: 'log_query' });
}

function sendDataViaJsonp(data) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        window[callbackName] = function(response) {
            delete window[callbackName];
            const script = document.getElementById(callbackName);
            if (script) script.parentNode.removeChild(script);
            resolve(response);
        };
        const timeout = setTimeout(() => {
            delete window[callbackName];
            const script = document.getElementById(callbackName);
            if (script) script.parentNode.removeChild(script);
            reject(new Error('JSONP request timeout'));
        }, 30000);
        const originalCallback = window[callbackName];
        window[callbackName] = function(response) {
            clearTimeout(timeout);
            originalCallback(response);
        };
        const params = new URLSearchParams();
        params.append('callback', callbackName);
        for (const [key, value] of Object.entries(data)) params.append(key, value);
        const script = document.createElement('script');
        script.id = callbackName;
        script.src = CONFIG.APPS_SCRIPT_URL + '?' + params.toString();
        script.onerror = function() {
            clearTimeout(timeout);
            delete window[callbackName];
            script.parentNode.removeChild(script);
            reject(new Error('JSONP script load error'));
        };
        document.head.appendChild(script);
    });
}

function sendDataViaForm(data) {
    return new Promise((resolve, reject) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = CONFIG.APPS_SCRIPT_URL;
        form.target = 'response_iframe';
        form.style.display = 'none';
        for (const [key, value] of Object.entries(data)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        }
        const iframe = document.createElement('iframe');
        iframe.name = 'response_iframe';
        iframe.style.display = 'none';
        let responseReceived = false;
        function handleMessage(event) {
            if (event.data && event.data.type === 'FORM_RESPONSE') {
                responseReceived = true;
                cleanup();
                resolve(event.data.data);
            }
        }
        iframe.onload = function() {
            setTimeout(() => {
                if (!responseReceived) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        const responseElement = iframeDoc.getElementById('response');
                        if (responseElement) {
                            const responseText = responseElement.textContent || responseElement.innerText;
                            cleanup();
                            resolve(JSON.parse(responseText));
                        } else {
                            cleanup();
                            resolve({ success: true });
                        }
                    } catch {
                        cleanup();
                        resolve({ success: true });
                    }
                }
            }, 2000);
        };
        iframe.onerror = function() { cleanup(); reject(new Error('Failed to load response iframe')); };
        function cleanup() {
            window.removeEventListener('message', handleMessage);
            if (form.parentNode) form.parentNode.removeChild(form);
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }
        window.addEventListener('message', handleMessage);
        document.body.appendChild(form);
        document.body.appendChild(iframe);
        form.submit();
        setTimeout(() => { if (!responseReceived) cleanup(); resolve({ success: true }); }, 15000);
    });
}

async function sendData(data) {
    try {
        return await sendDataViaJsonp(data);
    } catch {
        return await sendDataViaForm(data);
    }
}

async function exec_sendData() {
    try {
        await loadReCaptcha(CONFIG.RECAPTCHA_SITE_KEY);
        const params = parseQueryParams();
        
        console.log('Parsed params:', params);
        
        if (!validateParams(params)) {
            console.log('Validation failed - missing required params');
            return;
        }
        
        const recaptchaToken = await getReCaptchaToken();
        console.log('reCAPTCHA token obtained');
        
        const dataToSend = {
            code: params.code || "",
            app_name: params.app_name,
            char_id: params.char_id,
            user_lang: window.navigator.language,
            origin: window.location.origin,
            referer: window.location.href,
            recaptchaToken
        };
        
        console.log('Data to send:', dataToSend);
        
        const result = await sendData(dataToSend);
        console.log('Send result:', result);
        
        return result;
    } catch (error) {
        console.error('exec_sendData error:', error);
    }
}
