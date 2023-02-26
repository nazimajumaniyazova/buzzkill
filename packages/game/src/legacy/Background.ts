import {Game} from './Game'
import {Layer} from './Layer'
export class Background {
  game: Game;
  image: CanvasImageSource;
  layer1: Layer;
  layers: Array<Layer>
  hight: number;
  constructor(game: Game){
    this.game = game;
    this.image = new Image();
    this.image.src ='./catalog-img/bg-15.jpg'
    this.hight = 221;
    this.layer1 = new Layer(this.game, this.image, 1, this.game.height)
    this.layers = [this.layer1]
  }
  update(){
    this.layers.forEach(layer =>{
      layer.update()
    })
  }
  draw(context: CanvasRenderingContext2D){
    this.layers.forEach(layer => layer.draw(context))
  }
}