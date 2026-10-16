// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
  // Preloader functionality
  const preloader = document.getElementById('preloader');
  
  window.addEventListener('load', function() {
    setTimeout(() => {
      preloader.classList.add('hidden');
      document.body.classList.add('loaded');
      
      setTimeout(() => {
        preloader.style.display = 'none';
      }, 500);
    }, 2000);
  });

  // Mobile Navigation Toggle
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');
  
  menuToggle.addEventListener('click', function() {
    navLinks.classList.toggle('active');
    menuToggle.classList.toggle('active');
    menuToggle.setAttribute('aria-expanded', navLinks.classList.contains('active'));
  });

  // Close mobile menu when clicking outside
  document.addEventListener('click', function(event) {
    if (!event.target.closest('nav') && !event.target.closest('#menu-toggle')) {
      navLinks.classList.remove('active');
      menuToggle.classList.remove('active');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Category Tabs
  const categoryTabs = document.querySelectorAll('.category-tab');
  const productSections = document.querySelectorAll('.products-section');
  
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs
      categoryTabs.forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Get category from data attribute
      const category = this.dataset.category;
      
      // Hide all product sections
      productSections.forEach(section => {
        section.classList.remove('active');
      });
      
      // Show selected product section
      const targetSection = document.getElementById(category);
      if (targetSection) {
        targetSection.classList.add('active');
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Modal functionality
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDescription = document.getElementById('modalDescription');
  const closeBtns = document.querySelectorAll('.close-btn, .close-modal-btn');
  const whatsappBtn = document.getElementById('whatsappBtn');

  // Function to open modal with product details
  function openModal(productCard) {
    const img = productCard.querySelector('img');
    const title = productCard.dataset.title;
    const description = productCard.dataset.description;
    
    // Set modal content
    modalImage.src = img.src;
    modalImage.alt = img.alt;
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    
    // Update WhatsApp button
    whatsappBtn.onclick = function() {
      const message = encodeURIComponent(
        `Hello! I'm interested in your ${title}.\n\n` +
        `Product Details: ${description}\n\n` +
        `Please provide pricing and availability information.`
      );
      window.open(`https://wa.me/2348057185714?text=${message}`, '_blank');
    };
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Add click event to all product cards
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function() {
      openModal(this);
    });
  });

  // Add click event to view details buttons
  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent card click event
      const productCard = this.closest('.product-card');
      openModal(productCard);
    });
  });

  // Close modal functionality
  closeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    });
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });

  // Close modal with ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });

  // Scroll to Top Button
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  
  window.addEventListener('scroll', function() {
    if (window.scrollY > 500) {
      scrollTopBtn.style.display = 'flex';
    } else {
      scrollTopBtn.style.display = 'none';
    }
  });

  scrollTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Update current year in footer
  document.getElementById('currentYear').textContent = new Date().getFullYear();

  // Newsletter form submission
  const newsletterForm = document.querySelector('.newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = this.querySelector('input[type="email"]').value;
      
      // Here you would typically send this to your backend
      // For now, just show a success message
      alert('Thank you for subscribing to our newsletter!');
      this.reset();
    });
  }

  // Lazy loading for images
  const lazyImages = document.querySelectorAll('img[loading="lazy"]');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  }

  // Add loading animation to buttons on click
  document.querySelectorAll('button, .cta-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      // Skip if it's a link
      if (this.tagName === 'A') return;
      
      // Add loading state
      this.classList.add('loading');
      const originalHTML = this.innerHTML;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      
      // Remove loading state after 1.5 seconds
      setTimeout(() => {
        this.classList.remove('loading');
        this.innerHTML = originalHTML;
      }, 1500);
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      
      if (href !== '#') {
        e.preventDefault();
        const targetElement = document.querySelector(href);
        
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

  // Initialize animations on scroll
  const animateOnScroll = function() {
    const elements = document.querySelectorAll('.product-card, .section-header');
    
    elements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.2;
      
      if (elementPosition < screenPosition) {
        element.classList.add('fade-in');
      }
    });
  };

  window.addEventListener('scroll', animateOnScroll);
  // Initial call to show elements already in view
  animateOnScroll();
});