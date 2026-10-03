// MILO MUSHROOM - FINAL POLISHED
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let state="menu", level=1;

let player={x:50,y:200,vy:0,hp:100};
let enemies=[], boss=null, bullets=[], keys={};

window.addEventListener("keydown",e=>keys[e.key]=true);
window.addEventListener("keyup",e=>keys[e.key]=false);

const playerImg=new Image(); playerImg.src="https://i.imgur.com/4LGAZ8t.png";
const enemyImg=new Image(); enemyImg.src="https://i.imgur.com/Z6X9K8V.png";
const bossImg=new Image(); bossImg.src="https://i.imgur.com/j8sF9XH.png";

function spawnEnemies(){ enemies=[{x:200,y:200,alive:true,dir:1}]; }
function spawnBoss(){ boss={x:150,y:50,hp:20,dir:2,timer:0}; }

function updateBoss(){
 if(!boss)return;
 boss.x+=boss.dir;
 if(boss.x<0||boss.x>350)boss.dir*=-1;
 boss.timer++;
 if(boss.timer>60){
  boss.timer=0;
  if(boss.hp>10){
   bullets.push({x:boss.x+20,y:boss.y+20,vy:3});
  }else{
   for(let i=-2;i<=2;i++){
    bullets.push({x:boss.x+20,y:boss.y+20,vy:3,vx:i});
   }
  }
 }
}

function update(){
 if(state!=="game")return;

 if(keys["a"])player.x-=3;
 if(keys["d"])player.x+=3;
 if(keys[" "]&&player.y>=200)player.vy=-10;

 player.vy+=0.5;
 player.y+=player.vy;
 if(player.y>200){player.y=200;player.vy=0;}

 enemies.forEach(e=>{
  if(!e.alive)return;
  e.x+=e.dir;
  if(e.x<0||e.x>380)e.dir*=-1;
  if(player.x<e.x+20&&player.x+20>e.x&&player.y<200){
   e.alive=false; player.vy=-8;
  }
 });

 updateBoss();

 bullets.forEach(b=>{
  b.y+=b.vy; b.x+=b.vx||0;
  if(player.x<b.x+5&&player.x+20>b.x&&player.y<b.y+10&&player.y+20>b.y){
   player.hp-=1;
  }
 });
}

function draw(){
 ctx.clearRect(0,0,400,300);

 if(state==="menu"){
  ctx.fillStyle="white"; ctx.fillText("Press ENTER",150,150);
 }

 if(state==="map"){
  ctx.fillText("Press 1-3 to select level",100,150);
 }

 if(state==="game"){
  ctx.drawImage(playerImg,player.x,player.y,32,32);
  enemies.forEach(e=>{if(e.alive)ctx.drawImage(enemyImg,e.x,200,32,32);});
  if(boss)ctx.drawImage(bossImg,boss.x,boss.y,64,64);
  ctx.fillStyle="yellow"; bullets.forEach(b=>ctx.fillRect(b.x,b.y,5,10));
  ctx.fillStyle="white"; ctx.fillText("HP:"+player.hp,10,10);
 }
}

function loop(){update();draw();requestAnimationFrame(loop);}

window.addEventListener("keydown",e=>{
 if(e.key==="Enter"&&state==="menu")state="map";
 else if(state==="map"){
  if(e.key==="1")startLevel(1);
  if(e.key==="2")startLevel(2);
  if(e.key==="3")startLevel(3);
 }
});

function startLevel(lv){
 state="game"; level=lv;
 spawnEnemies();
 if(lv===3)spawnBoss();
}

loop();
