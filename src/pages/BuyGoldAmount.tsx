import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BuyGoldAmount = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/swap?to=XAUT');
  }, [navigate]);
  
  return null;
};

export default BuyGoldAmount;
