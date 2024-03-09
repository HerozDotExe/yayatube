pkg update && pkg upgrade
pkg add nodejs ffmpeg git
git clone https://github.com/HerozDotExe/yayatube.git
npm i
npm run build
echo Now, run "npm run preview" to start server.