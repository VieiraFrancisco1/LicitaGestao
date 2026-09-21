import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const slides = [
  { src: '/auth-showcase-1.jpg', alt: 'Mais oportunidades para o seu negócio com o LicitaGestão' },
  { src: '/auth-showcase-2.jpg', alt: 'Organize hoje e tenha mais oportunidades amanhã com o LicitaGestão' }
];

export function AccessShowcaseCarousel() {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSlideIndex((current) => (current + 1) % slides.length),
      5_000
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="login-hero login-promo-carousel auth-showcase-hero" aria-label="Apresentação do LicitaGestão">
      <div className="login-promo-viewport">
        {slides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            className={index === slideIndex ? 'active' : ''}
            aria-hidden={index !== slideIndex}
          />
        ))}
      </div>

      <div className="auth-showcase-navigation">
        <button
          type="button"
          className="login-carousel-arrow previous"
          aria-label="Imagem anterior"
          onClick={() => setSlideIndex((current) => (current - 1 + slides.length) % slides.length)}
        >
          <ChevronLeft size={20} />
        </button>

        <div className="login-carousel-dots" aria-label="Selecionar imagem">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.src}
              className={index === slideIndex ? 'active' : ''}
              aria-label={`Mostrar imagem ${index + 1}`}
              onClick={() => setSlideIndex(index)}
            />
          ))}
        </div>

        <button
          type="button"
          className="login-carousel-arrow next"
          aria-label="Próxima imagem"
          onClick={() => setSlideIndex((current) => (current + 1) % slides.length)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
