# Deploy al VPS

```bash
# En tu terminal local, conectar al VPS:
ssh -i ~/.ssh/id_ed25519 ubuntu@13.59.209.180

# En el VPS:
cd /var/www/ADICTIONBOUTIQUE
git pull origin master
npm run build
pm2 restart adiction-boutique
pm2 logs adiction-boutique --lines 20
```
