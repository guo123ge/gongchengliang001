set -e
cd /opt/gongchengliang001
git pull origin main
npm ci
npm run build
pm2 restart gongchengliang001
pm2 save
curl -I http://127.0.0.1:3000 || true
