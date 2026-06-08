# 腾讯云轻量服务器部署说明

目标服务器：OpenCloudOS 9，公网 IP `124.221.103.75`。

## 1. 安装运行环境

```bash
sudo dnf install -y git nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

## 2. 准备目录

```bash
sudo mkdir -p /opt/gongchengliang001/data /opt/gongchengliang001/uploads
sudo chown -R $USER:$USER /opt/gongchengliang001
```

将项目代码放到 `/opt/gongchengliang001`，然后执行：

```bash
cd /opt/gongchengliang001
npm ci
cp .env.production.example .env.production
vi .env.production
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 3. 配置 Nginx

```bash
sudo cp deploy/nginx-gongchengliang001.conf /etc/nginx/conf.d/gongchengliang001.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

访问地址：`http://124.221.103.75`。

## 4. 日常更新

```bash
cd /opt/gongchengliang001
git pull
npm ci
npm run build
pm2 restart gongchengliang001
```

## 5. 数据备份

建议每日备份：

```bash
tar -czf /opt/gongchengliang001-backup-$(date +%F).tar.gz \
  /opt/gongchengliang001/data \
  /opt/gongchengliang001/uploads
```
