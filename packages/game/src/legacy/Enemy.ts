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
  constructor(game: Game) {
    this.game = game;
    this.x = this.game.width;
    this.speedX = Math.random() * -3 - 1;
    this.markedForDeletion = false;
    this.frameX = 0
    this.frameY = 0
    this.frame = -1
    this.maxFrame = 12;
    this.liveProgress = 50;
  }
  update(width: number) {
    this.x += this.speedX;
    if(this.x + width < 0) {
      this.markedForDeletion = true
    }
    //animation
    if(this.frameX < this.maxFrame) {
       this.frameX++
    }else {
       this.frameX =0
    }
  }
  draw(context: CanvasRenderingContext2D,  image: HTMLImageElement , y: number, width: number, height: number, lives: number, score: number) {
  //  console.log(image)
    //context.strokeRect(this.x, y, width /2, height/2)
    context.drawImage(
      image, 
      this.frameX * width, 
      0,
      width,
      height, 
      this.x, 
      y, 
      width /2, 
      height /2
    )
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
    this.width = 273
    this.height = 282
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
  update(){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.width, this.height, this.lives, this.score)
  }
}

export class Enemy2 extends Enemy {
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
    this.width = 253
    this.height = 207
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2 +0.5;
    this.image.src = './catalog-img/enemy-2.png'
  }
  update(){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.width, this.height, this.lives, this.score)
  }
}
export class Enemy3 extends Enemy {
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
    this.width = 266
    this.height = 207
    this.angle = 0
    this.angleSpeed = Math.random() * 0.5
    this.y = Math.random() * (this.game.height  - this.height * 0.8)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 2 + 0.5;
    this.image.src = './catalog-img/enemy-3.png'
  }
  update(){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.width, this.height, this.lives, this.score)
  }
}
