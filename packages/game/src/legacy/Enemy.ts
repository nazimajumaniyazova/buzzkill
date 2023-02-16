import {Game} from './Game'
export class Enemy {
  game: Game;
  x: number;
  speedX: number;
  markedForDeletion: boolean
  frameX: number
  frameY: number
  maxFrame: number
  constructor(game: Game) {
    this.game = game;
    this.x = this.game.width;
    this.speedX = Math.random() * -1.5 - 0.5;
    this.markedForDeletion = false;
    this.frameX = 0
    this.frameY = 0
    this.maxFrame = 6;
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
  draw(context: CanvasRenderingContext2D, y: number, width: number, height: number, image: CanvasImageSource) {
    context.strokeRect(this.x, y, width, height)
    context.drawImage(
      image, 
      this.frameX * width, 
      this.frameY * height,
      width,
      height, 
      this.x, 
      y, 
      width, 
      height
    )
    context.fillStyle = 'black'
    context.font = '20px Helvetica'
    context.fillText('2', this.x, y)
  }
}

export class Angler1 extends Enemy {
  width: number
  height: number
  y:number
  image:  CanvasImageSource;
  frameY: number;
  lives: number
  score: number
  constructor(game: Game) {
    super(game)
    this.width = 228;
    this.height = 169;
    this.y = Math.random() * (this.game.height * 0.9 - this.height)
    this.image = new Image(this.width, this.height);
    this.image.src ='./catalog-img/enemy2.png'
    this.frameY = Math.floor(Math.random() * 3)
    this.lives = 2;
    this.score = this.lives
  }
  update(){
    super.update(this.width)
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.y, this.width, this.height, this.image)
    console.log('дошел')
  }
}

// class Angler2 extends Enemy {
//   width: number
//   height: number
//   y:number
//   image:  CanvasImageSource;
//   frameY: number;
//   lives: number
//   score: number
//   constructor(game: Game) {
//     super(game)
//     this.width = 213;
//     this.height = 165;
//     this.y = Math.random() * (this.game.height * 0.9 - this.height)
//     this.image = new Image(this.width, this.height);
//     this.image.src ='./catalog-img/enemy2.png'
//     this.frameY = Math.floor(Math.random() * 2)
//     this.lives = 3;
//     this.score = this.lives
//   }
// }
// class Lucky extends Enemy {
//   width: number;
//   height:number;
//   y:number
//   image:CanvasImageSource;
//   frameY:number
//   lives:number
//   score:number;
//   type: string;
//   constructor(game: Game) {
//     super(game)
//     this.width = 99;
//     this.height = 95;
//     this.y = Math.random() * (this.game.height * 0.9 - this.height)
//     this.image = new Image(this.width, this.height);
//     this.image.src ='./catalog-img/enemy2.png'
//     this.frameY = Math.floor(Math.random() * 2)
//     this.lives = 3;
//     this.score = 15;
//     this.type = 'lucky'
//   }
// }