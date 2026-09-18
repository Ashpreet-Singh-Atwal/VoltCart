export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <h4>VoltCart</h4>
          <p>Lightning-fast deals on everyday electronics. Built for the flash-sale rush.</p>
        </div>
        <div>
          <h4>Company</h4>
          <span>About us</span><span>Careers</span><span>Press</span>
        </div>
        <div>
          <h4>Help</h4>
          <span>Shipping</span><span>Returns</span><span>Contact</span>
        </div>
        <div>
          <h4>Legal</h4>
          <span>Terms of use</span><span>Privacy policy</span><span>Cookie policy</span>
        </div>
      </div>
      <p className="footer__note">© {new Date().getFullYear()} VoltCart · Demo storefront. No real orders are shipped.</p>
    </footer>
  );
}
