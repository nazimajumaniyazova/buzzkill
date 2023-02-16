// import {Background} from './Background'
import {Player} from './Player'
import {InputHandler} from './InputHandler'
// import {UI} from './UI'
import { Angler1} from './Enemy'

export class Game {
  // background: Background;
  player: Player;
  input: InputHandler;
  // ui: UI;
  enemies: Array<Angler1>
  width: number; // ширина окна/поле canvas
  height: number; // высота  окна/поле canvas
  ammo: number; // патроны
  maxAmmo: number; // макс патроны
  ammoTimer: number;
  ammoInterval: number;
  // enemyTimer: number;
  // enemyInterval: number;
  // gameOver: boolean;
  // score: number;
  // winningScore:number;
  // gameTime: number;
  // timeLimit: number;
  // speed: number;
  keys: Array<string> // название клавиш
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // this.background = new Background(this)
    this.player = new Player(this);
    //console.log(this.player)
    this.input = new InputHandler(this);
    // this.ui = new UI(this)
    this.keys = []
    this.enemies = []
    this.ammo = 20;
    this.maxAmmo = 50
    this.ammoTimer = 0
    this.ammoInterval = 200;
    // this.enemyTimer = 0
    // this.enemyInterval = 500
    // this.gameOver = false
    // this.score = 0
    // this.winningScore = 10
    // this.gameTime = 0;
    // this.timeLimit = 15000;
    // this.speed = 1;
  }
  update(deltaTime: number) {

    // if(!this.gameOver) this.gameTime += deltaTime;
    // if(this.gameTime > this.timeLimit) this.gameOver = true
    // this.background.update()
    // //player
    this.player.update()
    // обновление патронов
    if(this.ammoTimer > this.ammoInterval) {
      if(this.ammo < this.maxAmmo) this.ammo++
      this.ammoTimer = 0
    }else {
      this.ammoTimer +=deltaTime
    }
    //обработка врагов
    this.enemies.forEach(enemy => {
      enemy.update();
    })
    // this.enemies.forEach(enemy => {
    //   enemy.update()
    //   console.log(this.checkCollision(this.player, enemy))
    //   if(this.checkCollision(this.player, enemy)) {
    //     enemy.markedForDeletion = true;
    //     if(enemy.type = 'lucky') {
    //       this.player.enterPowerUp()
    //     }else this.score--;
    //   }
    //   this.player.projectiles.forEach(projectile => {
    //     if(this.checkCollision(projectile, enemy)) {
    //       enemy.lives--
    //       projectile.markedForDeletion = true
    //       if(enemy.lives <=0) {
    //         enemy.markedForDeletion = true
    //         if(!this.gameOver) this.score += enemy.score;
    //         if(this.score > this.winningScore) {
    //           this.gameOver = true;
    //         }
    //       }
    //     }
    //   })
    // })
    //enemy
    this.enemies = this.enemies.filter(enemy => !enemy.markedForDeletion)
    // if(this.enemyTimer > this.enemyInterval && !this.gameOver) {
    //   this.addEnemy()
    //   this.enemyTimer = 0
    // } else {
    //   this.enemyTimer += deltaTime
    // }
  }
  draw(context: CanvasRenderingContext2D) {
    // this.background.draw(context)
    this.player.draw(context)
    // this.ui.draw(context)
    this.enemies.forEach(enemy => {
      enemy.draw(context)
    })
  }
  addEnemy() {
    const randomize = Math.random();
    if( randomize < 0.3){
      this.enemies.push(new Angler1(this))
    }else if (randomize < 0.6){
      this.enemies.push(new Angler2(this))
    } else {
      this.enemies.push(new Lucky(this))
    }
    //console.log(this.enemies)
  }
  // checkCollision(rect1, rect2) {
  // const res =  rect1.x < rect2.x + rect2.width && 
  //             rect1.x + rect1.width > rect2.x &&
  //             rect1.y < rect2.y + rect2.height &&
  //             rect1.height + rect1.y > rect2.y
  // return res;
  // }
}