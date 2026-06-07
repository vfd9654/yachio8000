import pygame
from pygame.locals import *
import os

import live2d.v3 as live2d
from live2d.utils import log
from live2d.utils.image import Image

live2d.enableLog(True)
live2d.setLogLevel(live2d.Live2DLogLevels.LV_DEBUG)


def main():
    pygame.init()
    live2d.init()

    display = (800, 450)
    pygame.display.set_mode(display, DOUBLEBUF | OPENGL)
    pygame.display.set_caption("Live2D Basic Rendering with Background")

    live2d.glInit()

    # Load model
    model = live2d.LAppModel()
    
    # Load background image
    background_path = "back.png"  # Make sure back.png is in your project directory
    if os.path.exists(background_path):
        background = Image(background_path)
        print("Background loaded successfully!")
    else:
        print(f"Warning: Background image not found at {background_path}")
        background = None

    # Load model with error checking
    model_path = "alive2d_model/八千代辉夜姬.model3.json"
    
    if not os.path.exists(model_path):
        print(f"Error: Model file not found at {model_path}")
        print("Please check the path to your .model3.json file")
        live2d.dispose()
        pygame.quit()
        return
    
    try:
        model.LoadModelJson(model_path)
        model.Resize(*display)
        model.SetOffsetY(-0.25)
        model.SetScale(0.9)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Failed to load model: {e}")
        live2d.dispose()
        pygame.quit()
        return

    running = True
    clock = pygame.time.Clock()
    model.StartMotion("笑咪咪",priority=1, no=0)
    while running:
        delta_time = clock.tick(60) / 1000.0
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
            elif event.type == pygame.MOUSEMOTION:
                # Optional: Add mouse interaction
                model.Drag(*pygame.mouse.get_pos())

        # Clear buffer with transparent/black background
        live2d.clearBuffer(0.0, 0.0, 0.0, 0.0)
        
        # Draw background first (so it appears behind the model)
        if background:
            background.Draw()
        
        # Update and draw Live2D model
        model.Update()
        model.Draw()
        
        pygame.display.flip()

    # Cleanup
    live2d.dispose()
    pygame.quit()


if __name__ == "__main__":
    main()