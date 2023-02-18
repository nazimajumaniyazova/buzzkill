import {Game} from './Game'
import {Layer} from './Layer'
export class Background {
  game: Game;
  image: CanvasImageSource;
  layer: Layer;
  layers: Array<Layer>
  constructor(game: Game){
    this.game = game;
    this.image = new Image();
    this.image.src ='./catalog-img/bg-3.jpg'
    this.image.blur()
    this.layer = new Layer(this.game, this.image, 1)
    this.layers = [this.layer]
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