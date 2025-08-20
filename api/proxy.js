export default async function handler(req, res) {
    // 替换为你的ECS IP地址
    const ECS_IP = "118.31.105.113";
    const targetUrl = `http://${ECS_IP}${req.url || '/'}`;
    
    try {
      // 清理请求头，移除可能造成问题的头部
      const cleanHeaders = { ...req.headers };
      delete cleanHeaders.host;
      delete cleanHeaders['x-forwarded-for'];
      delete cleanHeaders['x-forwarded-proto'];
      delete cleanHeaders['x-forwarded-host'];
      delete cleanHeaders['x-vercel-forwarded-for'];
      delete cleanHeaders['x-vercel-id'];
      
      // 构建请求选项
      const fetchOptions = {
        method: req.method,
        headers: cleanHeaders,
      };
  
      // 对于POST/PUT等请求，添加body
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        } else {
          fetchOptions.body = JSON.stringify(req.body);
        }
      }
  
      // 向目标服务器发送请求
      const response = await fetch(targetUrl, fetchOptions);
      
      // 获取响应头并清理
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        // 跳过可能造成问题的响应头
        if (!['content-encoding', 'transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });
      
      // 确保正确的MIME类型
      const contentType = response.headers.get('content-type') || '';
      
      // 处理JavaScript文件的MIME类型
      if (req.url && (req.url.endsWith('.js') || req.url.includes('.js?'))) {
        responseHeaders['content-type'] = 'application/javascript; charset=utf-8';
      }
      
      // 处理CSS文件的MIME类型
      if (req.url && (req.url.endsWith('.css') || req.url.includes('.css?'))) {
        responseHeaders['content-type'] = 'text/css; charset=utf-8';
      }
      
      // 设置响应头
      Object.entries(responseHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      // 处理不同类型的响应
      if (contentType.includes('text/html')) {
        let data = await response.text();
        
        // 替换HTML中的绝对URL引用
        data = data.replace(new RegExp(`http://${ECS_IP}`, 'g'), `https://${req.headers.host}`);
        
        // 添加CSP头来允许内联脚本
        res.setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline' 'unsafe-eval'; object-src 'none';");
        
        res.status(response.status).send(data);
      } else if (contentType.includes('application/json')) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        // 处理二进制内容和其他文件
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
      }
      
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ 
        error: 'Proxy failed', 
        message: error.message,
        url: targetUrl
      });
    }
  }