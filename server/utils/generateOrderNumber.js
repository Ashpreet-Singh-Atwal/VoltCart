const generateOrderNumber = () => {
  const year = new Date().getFullYear();

  const randomNumber =
    Math.floor(
      10000 + Math.random() * 90000
    );

  return `VC-${year}-${randomNumber}`;
};

module.exports = generateOrderNumber;