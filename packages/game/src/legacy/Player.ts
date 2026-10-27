import {Game} from './Game'
import {Projectile} from './Projectile'
export class Player {
  game: Game
  width: number;
  height: number;
  x: number;
  y: number;
  speedY: number
  maxSpeed: number;
  projectiles: Array<Projectile>
  image: CanvasImageSource;
  constructor(game: Game){
    this.game = game;
    this.image = new Image()
    if(this.game.chosedHero === 'female') {
      this.width = 172 *0.8
      this.height = 212 *0.7
      this.image.src = './catalog-img/female.png'
    }else{
      this.width = 229 *0.7
      this.height = 226 *0.7
      this.image.src = './catalog-img/male.png'
    }
    this.x = 20
    this.y = 100
    this.speedY = 1 // вертикальное движение
    this.maxSpeed = 4; // на сколько пикселем двигаем при нажатии
    this.projectiles = [];
  }
  update() {
    if (this.game.keys.includes('ArrowUp')) {
      this.speedY = -this.maxSpeed;
    } else if (this.game.keys.includes('ArrowDown')){
      this.speedY = this.maxSpeed
    } else {
      this.speedY = 0
    }
    this.y += this.speedY;
    // обработка границ
    if( this.y >this.game.height - this.height * 0.8) {
      this.y = this.game.height - this.height * 0.8
    }else if(this.y < - this.height*0.2) {
      this.y = -this.height*0.2
    }
    //обратобка патронов
    this.projectiles.forEach(projectile => {
      projectile.update();
    })
    this.projectiles = this.projectiles.filter(projectile => !projectile.markedForDeletion)
  }
  draw(context: CanvasRenderingContext2D) {
  //  context.strokeRect(this.x, this.y, this.width, this.height);
    context.drawImage(
      this.image, 
      this.x, 
      this.y, 
      this.width, 
      this.height)
    //рисуем патроны
    this.projectiles.forEach(projectile => {
      projectile.draw(context)
    })
  }
  shootTop(){
    if(this.game.ammo > 0) {
      this.projectiles.push(new Projectile(this.game, this.x + 105, this.y + 90)) 
    }
  }
}