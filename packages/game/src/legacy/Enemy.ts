/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {Game} from './Game'
export class Enemy {
  game: Game;
  x: number;
  speedX: number;
  markedForDeletion: boolean
  frameX: number
  frameY: number
  maxFrame: number;
  frame: number;
  liveProgress: number;
  timeSinceFlap: number
  flapInterval: number
  constructor(game: Game, maxFrame?: number) {
    this.game = game;
    this.x = this.game.width;
    this.speedX = Math.random() * -3 - 1.5;
    this.markedForDeletion = false;
    this.frameX = 0
    this.frameY = 0
    this.frame = -1
    if(maxFrame){
      this.maxFrame = maxFrame
    }else {
      this.maxFrame = 12;
    }
    this.liveProgress = 50;
    this.timeSinceFlap = 0
    this.flapInterval = Math.random() * 25 + 25
  }
  update(width: number, deltaTime?: number) {
    if(deltaTime){
      this.timeSinceFlap += deltaTime
      if(this.timeSinceFlap > this.flapInterval){
        if(this.frameX < this.maxFrame) {
          this.frameX++
        }else {
          this.frameX =0
        }
       this.timeSinceFlap = 0
      }
    }else{
      //animation
      if(this.frameX < this.maxFrame) {
        this.frameX++
      }else {
        this.frameX =0
      }
    }
    this.x += this.speedX;
    if(this.x + width < 0) {
      this.markedForDeletion = true
    }
  }
  draw(context: CanvasRenderingContext2D,  image: HTMLImageElement , y: number, width: number, height: number, lives: number, score: number, enemyType?: string) {
  //  console.log(image)
    //context.strokeRect(this.x, y, width*0.5, height*0.5)
    if( enemyType === 'enemyNight'){
      context.drawImage(
        image, 
        this.frameX * width, 
        0,
        width,
        height, 
        this.x, 
        y, 
        width * 2, 
        height * 2
      )
    }else{
      context.drawImage(
        image, 
        this.frameX * width, 
        0,
        width,
        height, 
        this.x, 
        y, 
        width *0.5, 
        height *0.5
      )
    }
    // context.fillStyle = 'black'
    // context.font = '20px Helvetica'
    // context.fillText(`${lives}`, this.x, y)

    context.fillStyle = '#000';
    context.strokeRect(this.x,y + 10, 50, 10);
    context.fillStyle = '#48BF53'
    context.fillRect(this.x, y + 10, ( 50  * lives)/ score , 10)
  }
}

//do waving movment
export class Enemy1 extends Enemy {
  width: number
  height: number
  realWidth: number;
  realHeight: number;
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  curve: number
  constructor(game: Game) {
    super(game)
    this.realHeight = 273
    this.realWidth = 273
    this.width = this.realHeight * 0.5
    this.height = this.realWidth * 0.5
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height -this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2;
    this.image.src = './catalog-img/enemy-1.png'
  }
  update(deltaTime: number){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.realWidth, this.realHeight, this.lives, this.score)
  }
}

export class Enemy2 extends Enemy {
  realWidth: number;
  realHeight: number;
  width: number
  height: number
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  curve: number
  constructor(game: Game) {
    super(game)
    this.realHeight = 207
    this.realWidth = 253
    this.width = this.realWidth *0.5
    this.height = this.realHeight *0.5
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2;
    this.image.src = './catalog-img/enemy-2.png'
  }
  update(deltaTime: number){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.realWidth, this.realHeight, this.lives, this.score)
  }
}
export class Enemy3 extends Enemy {
  realWidth: number;
  realHeight: number;
  width: number
  height: number
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  curve: number
  constructor(game: Game) {
    super(game)
    this.realHeight = 207
    this.realWidth = 266
    this.width = this.realWidth * 0.5
    this.height = this.realHeight * 0.5
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2;
    this.image.src = './catalog-img/enemy-3.png'
  }
  update(deltaTime: number){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.realWidth, this.realHeight, this.lives, this.score)
  }
}

export class EnemyNight1 extends Enemy {
  realWidth: number;
  realHeight: number;
  width: number
  height: number
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  curve: number
  constructor(game: Game) {
    super(game, 5)
    this.realHeight = 188
    this.realWidth = 266
    this.width = this.realWidth * 0.5
    this.height = this.realHeight * 0.5
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2;
    this.image.src = './catalog-img/enemy_bat_3.png'
  }
  update(deltaTime: number){
    super.update(this.width, deltaTime)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.realWidth, this.realHeight, this.lives, this.score)
  }
}
export class EnemyNight2 extends Enemy {
  realWidth: number;
  realHeight: number;
  width: number
  height: number
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  curve: number
  constructor(game: Game) {
    super(game, 5)
    this.realHeight = 194
    this.realWidth = 271
    this.width = this.realWidth * 0.5
    this.height = this.realHeight * 0.5
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2;
    this.image.src = './catalog-img/enemy_raven.png'
  }
  update(deltaTime: number){
    super.update(this.width, deltaTime)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.realWidth, this.realHeight, this.lives, this.score)
  }
}
export class EnemyNight3 extends Enemy {
  realWidth: number;
  realHeight: number;
  width: number
  height: number
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  curve: number
  constructor(game: Game) {
    super(game, 6)
    this.realHeight = 167
    this.realWidth = 238
    this.width = this.realWidth 
    this.height = this.realHeight 
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2;
    this.image.src = './catalog-img/enemy_bat_2.png'
  }
  update(deltaTime: number){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.realWidth, this.realHeight, this.lives, this.score)
  }
}