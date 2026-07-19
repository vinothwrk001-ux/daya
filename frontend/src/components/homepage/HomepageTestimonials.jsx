import { useEffect, useState, useCallback } from "react";
import { getStorefrontTestimonials } from "../../services/reviewService";
import { resolveApiAssetUrl } from "../../utils/resolveUrl";
import { formatCurrency } from "../../utils/formatCurrency";

function getProductImage(product) {
  const image = product?.images?.[0] || product?.image || product?.thumbnail;
  return typeof image === "string" ? image : image?.url || image?.secureUrl || "";
}

function getProductPrice(product) {
  return (
    product?.salePrice ??
    product?.pricing?.salePrice ??
    product?.price ??
    product?.pricing?.price ??
    null
  );
}

function getCustomerInitial(name) {
  return (name || "U").charAt(0).toUpperCase();
}

function StarRating({ value = 0 }) {
  const numericValue = Number(value) || 0;
  return (
    <span className="testimonial-stars" aria-label={`${numericValue} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`testimonial-star ${numericValue >= star ? "testimonial-star--filled" : ""}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function TestimonialCard({ review }) {
  const customer = review.customerId || {};
  const product = review.productId || {};
  const productImage = getProductImage(product);
  const productPrice = getProductPrice(product);
  const customerName = customer.name || "Anonymous";
  const _nameInitial = getCustomerInitial(customerName);
  const _avatarUrl = customer.avatarUrl ? resolveApiAssetUrl(customer.avatarUrl) : null;

  // Abbreviate name: "Emily Thompson" -> "Emily T."
  const nameParts = customerName.split(" ");
  const displayName =
    nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
      : nameParts[0];

  return (
    <div className="testimonial-card">
      <div className="testimonial-card__header">
        <span className="testimonial-card__name">{displayName}</span>
        {review.verifiedPurchase ? (
          <span className="testimonial-card__verified">
            <svg className="testimonial-card__verified-icon" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="8" fill="#22c55e" />
              <path d="M5 8.5L7 10.5L11 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Verified Buyer
          </span>
        ) : null}
      </div>

      <StarRating value={review.rating} />

      <p className="testimonial-card__review">
        {review.review || review.comment || review.title || "Great product!"}
      </p>

      <div className="testimonial-card__product">
        <div className="testimonial-card__product-image">
          {productImage ? (
            <img
              src={resolveApiAssetUrl(productImage)}
              alt={product.name || "Product"}
              loading="lazy"
            />
          ) : (
            <div className="testimonial-card__product-placeholder">
              {(product.name || "P").charAt(0)}
            </div>
          )}
        </div>
        <div className="testimonial-card__product-info">
          <span className="testimonial-card__product-label">
            Item purchased: <strong>{product.name || "Product"}</strong>
          </span>
          {productPrice !== null ? (
            <span className="testimonial-card__product-price">
              {formatCurrency(productPrice)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HomepageTestimonials() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(3);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await getStorefrontTestimonials();
        if (!cancelled) {
          setReviews(response?.data || response || []);
        }
      } catch {
        // Silently fail — testimonials are optional
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Responsive cards per page
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w < 640) setCardsPerPage(1);
      else if (w < 1024) setCardsPerPage(2);
      else setCardsPerPage(3);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalPages = Math.ceil(reviews.length / cardsPerPage);

  // Reset page if out of bounds when cardsPerPage changes
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [cardsPerPage, totalPages, currentPage]);

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 5000);
    return () => clearInterval(interval);
  }, [totalPages]);

  if (loading || reviews.length === 0) return null;

  const startIndex = currentPage * cardsPerPage;
  const visibleReviews = reviews.slice(startIndex, startIndex + cardsPerPage);

  return (
    <section className="testimonials-section" id="homepage-testimonials">
      <div className="testimonials-section__inner">
        {/* Header */}
        <div className="testimonials-section__header">
          <span className="testimonials-section__badge">TESTIMONIALS</span>
          <h2 className="testimonials-section__title">
            What Our Clients Say <span className="testimonials-section__emoji">👍</span>
          </h2>
        </div>

        {/* Cards grid */}
        <div
          className="testimonials-section__grid"
          style={{ "--cards-per-page": cardsPerPage }}
        >
          {visibleReviews.map((review) => (
            <TestimonialCard key={review._id} review={review} />
          ))}
        </div>

        {/* Dot pagination */}
        {totalPages > 1 ? (
          <div className="testimonials-section__dots">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to page ${i + 1}`}
                className={`testimonials-section__dot ${
                  i === currentPage ? "testimonials-section__dot--active" : ""
                }`}
                onClick={() => goToPage(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
