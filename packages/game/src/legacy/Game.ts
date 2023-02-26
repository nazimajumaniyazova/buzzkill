import {Background} from './Background'
import {Player} from './Player'
import {InputHandler} from './InputHandler'
import {UI} from './UI'
import { Enemy1, Enemy2, Enemy3 } from './Enemy'
import { Projectile } from './Projectile';
import { smokeExplostion, fireExplostion} from './Explostion'
export class Game {
  background: Background;
  player: Player;
  input: InputHandler;
  ui: UI;
  enemies: Array<Enemy1 | Enemy2 | Enemy3 >
  width: number; // ширина окна/поле canvas
  height: number; // высота  окна/поле canvas
  ammo: number; // патроны
  maxAmmo: number; // макс патроны
  ammoTimer: number;
  ammoInterval: number;
  enemyTimer: number;
  enemyInterval: number;
  gameOver: boolean;
  score: number;
  winningScore:number;
  gameTime: number;
  gameTimeLimit: number;
  speed: number;
  keys: Array<string> // название клавиш
  lives: number;
  chosedHero: string;
  explotions: Array<smokeExplostion |  fireExplostion>
  constructor(width: number, height: number, chosedHero: string) {
    this.chosedHero = chosedHero
    this.width = width;
    this.height = height;
    this.background = new Background(this)
    this.player = new Player(this);
    this.input = new InputHandler(this);
    this.ui = new UI(this)
    this.keys = []
    this.enemies = []
    this.ammo = 20;
    this.maxAmmo = 50
    this.ammoTimer = 0
    this.ammoInterval = 200;
    this.enemyTimer = 0
    this.enemyInterval = 1500 // добавляем врагов каждые 1мс

    this.gameOver = false
    this.score = 0
    this.winningScore = 1100
    this.gameTime = 0;
    this.gameTimeLimit = 60000;
    this.speed = 1;
    this.explotions = []
    this.lives = 5;
  }
  update(deltaTime: number) {

    if(!this.gameOver) this.gameTime += deltaTime;
    if(this.gameTime > this.gameTimeLimit) this.gameOver = true
    this.background.update()

    //player

    this.player.update()
    // обработка взрыва
    this.explotions.forEach(explotion => explotion.update(deltaTime))
    this.explotions = this.explotions.filter(explotion => !explotion.markForDeletion)
    // обновление патронов

    if(this.ammoTimer > this.ammoInterval) {
      if(this.ammo < this.maxAmmo) this.ammo++
      this.ammoTimer = 0
    }else {
      this.ammoTimer +=deltaTime
    }

    this.enemies.forEach(enemy => {
      enemy.update()
      if(this.checkCollision(this.player, enemy)) {
        enemy.markedForDeletion = true;
        this.lives--;
        if(this.lives <=0){
          this.gameOver = true;
        }
        // if(enemy.type = 'lucky') {
        //   this.player.enterPowerUp()
        // }else this.score--;
        //this.score--;
      }
      this.player.projectiles.forEach(projectile => {
        if(this.checkCollision(projectile, enemy)) {
          enemy.lives--; 
          projectile.markedForDeletion = true
          if(enemy.lives <=0) {
            this.addExplotion(enemy)
            enemy.markedForDeletion = true;
            if(!this.gameOver) this.score += enemy.score;
            if(this.score > this.winningScore) {
              this.gameOver = true;
            }
          }
        }
      })
    })

    //обработка врагов
    
    // this.enemies.forEach(enemy => {
    //   enemy.update();
    //   if(this.checkCollision(this.player, enemy)) {
    //     enemy.markedForDeletion = true;
    //     this.lives--;
    //     if(this.lives <= 0) this.gameOver = true;
    //     // if(enemy.type = 'lucky') {
    //     //   this.player.enterPowerUp()
    //     // }else this.score--;
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
    this.enemies = this.enemies.filter(enemy => !enemy.markedForDeletion) //удаляем ненужных(мертвых) врагов
    if(this.enemyTimer > this.enemyInterval && !this.gameOver) {
      this.addEnemy()
      this.enemyTimer = 0
    } else {
      this.enemyTimer += deltaTime
    }
    if(this.gameTime > 10000) {
      this.enemyInterval = this.enemyInterval - 200
      if(this.enemyInterval <= 400){
        this.enemyInterval = 400;
      }
    }
  }
  draw(context: CanvasRenderingContext2D) {
    this.background.draw(context)
    this.player.draw(context)
    this.ui.draw(context)
    this.enemies.forEach(enemy => {
      enemy.draw(context)
    })
    this.explotions.forEach(explotion => {
      explotion.draw(context)
    })
  }
  addEnemy() {
    const randomize = Math.random();
    if( randomize < 0.3){
      this.enemies.push(new Enemy1(this))
    }else if (randomize < 0.6){
      this.enemies.push(new Enemy2(this))
    } else {
      this.enemies.push(new Enemy3(this))
    }
  }

  addExplotion(enemy: Enemy1 | Enemy2 | Enemy3 ) {
    const randomize = Math.random();
    if(randomize < 0.5) {
      this.explotions.push(new smokeExplostion(
        this, 
        enemy.x + enemy.width * 0.5, 
        enemy.y + enemy.height * 0.5
        )
      )
    }else {
      this.explotions.push(new fireExplostion(this, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.5))
    }

  }
  checkCollision(rect1: Player | Projectile, rect2: Enemy1 | Enemy2 | Enemy3) {
  const res =  rect1.x < rect2.x + rect2.width && 
              rect1.x + rect1.width > rect2.x &&
              rect1.y < rect2.y + rect2.height &&
              rect1.height + rect1.y > rect2.y
  return res;
  }
}