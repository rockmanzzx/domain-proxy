export default async function handler(req, res) {
    // 替换为你的ECS IP地址
    const ECS_IP = "你的ECS_IP";
    const targetUrl = `http://${ECS_IP}${req.url || '/'}`;
    
    try {
      // 构建请求选项
      const fetchOptions = {
        method: req.method,
        headers: {
          ...req.headers,
          host: ECS_IP, // 覆盖host头
        },
      };
  
      // 对于POST/PUT等请求，添加body
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = JSON.stringify(req.body);
        fetchOptions.headers['content-type'] = 'application/json';
      }
  
      // 向目标服务器发送请求
      const response = await fetch(targetUrl, fetchOptions);
      
      // 获取响应内容
      const contentType = response.headers.get('content-type') || '';
      
      let data;
      if (contentType.includes('application/json')) {
        data = await response.json();
        res.status(response.status).json(data);
      } else if (contentType.includes('text/') || contentType.includes('html')) {
        data = await response.text();
        
        // 替换响应中的绝对URL（可选）
        data = data.replace(new RegExp(`http://${ECS_IP}`, 'g'), `https://${req.headers.host}`);
        
        res.status(response.status).send(data);
      } else {
        // 处理二进制内容（图片、文件等）
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
      }
      
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ 
        error: 'Proxy failed', 
        message: error.message 
      });
    }
  }