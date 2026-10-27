import type {Game} from './Game'
import {Layer} from './Layer'
import { placeholderSprite } from './placeholders'
export class Background {
  game: Game;
  image: CanvasImageSource;
  layer1: Layer;
  layers: Layer[]
  hight: number;
  constructor(game: Game){
    this.game = game;
    this.image = new Image();
    // The original backgrounds (bg-day.jpg, bg-night-4.jpg) are over the 1 MB limit; solid colours until stage 6.
    if(this.game.settings.mode === 'day'){
      this.image.src = placeholderSprite(1, 64, 64, '#bfe3ff')
    }else{
      this.image.src = placeholderSprite(1, 64, 64, '#121a2b')
    }
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