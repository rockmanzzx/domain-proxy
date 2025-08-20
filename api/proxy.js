export default async function handler(req, res) {
    // 替换为你的ECS IP地址
    const ECS_IP = "118.31.105.113";
    const targetUrl = `http://${ECS_IP}${req.url || '/'}`;
    
    try {
      // 清理请求头
      const cleanHeaders = { ...req.headers };
      delete cleanHeaders.host;
      delete cleanHeaders['x-forwarded-for'];
      delete cleanHeaders['x-forwarded-proto'];
      delete cleanHeaders['x-forwarded-host'];
      delete cleanHeaders['x-vercel-forwarded-for'];
      delete cleanHeaders['x-vercel-id'];
      delete cleanHeaders['x-real-ip'];
      
      // 构建请求选项
      const fetchOptions = {
        method: req.method,
        headers: cleanHeaders,
      };
  
      // 处理请求体
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        } else {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }
  
      // 向目标服务器发送请求
      const response = await fetch(targetUrl, fetchOptions);
      
      // 获取原始内容类型
      const originalContentType = response.headers.get('content-type') || '';
      
      // 根据文件扩展名确定正确的MIME类型
      let contentType = originalContentType;
      const url = req.url || '';
      const urlLower = url.toLowerCase();
      
      if (urlLower.endsWith('.js') || urlLower.includes('.js?') || urlLower.includes('.js#')) {
        contentType = 'application/javascript; charset=utf-8';
      } else if (urlLower.endsWith('.mjs') || urlLower.includes('.mjs?')) {
        contentType = 'application/javascript; charset=utf-8';
      } else if (urlLower.endsWith('.css') || urlLower.includes('.css?')) {
        contentType = 'text/css; charset=utf-8';
      } else if (urlLower.endsWith('.json') || urlLower.includes('.json?')) {
        contentType = 'application/json; charset=utf-8';
      } else if (urlLower.endsWith('.html') || urlLower.includes('.html?') || url === '/') {
        contentType = 'text/html; charset=utf-8';
      }
      
      // 设置响应状态
      res.status(response.status);
      
      // 复制响应头，但跳过问题头部
      response.headers.forEach((value, key) => {
        const keyLower = key.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'connection', 'keep-alive', 'content-length'].includes(keyLower)) {
          if (keyLower === 'content-type') {
            res.setHeader(key, contentType);
          } else {
            res.setHeader(key, value);
          }
        }
      });
      
      // 如果没有设置content-type，手动设置
      if (!response.headers.has('content-type')) {
        res.setHeader('Content-Type', contentType);
      }
      
      // 处理HTML内容
      if (contentType.includes('text/html')) {
        let data = await response.text();
        
        // 替换HTML中的绝对URL
        data = data.replace(new RegExp(`http://${ECS_IP}`, 'g'), `https://${req.headers.host}`);
        
        // 设置更宽松的CSP
        res.setHeader('Content-Security-Policy', 
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; " +
          "style-src 'self' 'unsafe-inline' blob: data:; " +
          "img-src 'self' data: blob: https:; " +
          "font-src 'self' data: https:; " +
          "connect-src 'self' https: wss: blob:; " +
          "media-src 'self' blob: data:; " +
          "object-src 'none'; " +
          "base-uri 'self';"
        );
        
        res.send(data);
      } else if (contentType.includes('application/json')) {
        const data = await response.json();
        res.json(data);
      } else {
        // 处理所有其他文件类型（JS, CSS, 图片等）
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
      
    } catch (error) {
      console.error('Proxy error:', error.message);
      console.error('Target URL:', targetUrl);
      res.status(500).json({ 
        error: 'Proxy failed', 
        message: error.message,
        url: targetUrl
      });
    }
  }