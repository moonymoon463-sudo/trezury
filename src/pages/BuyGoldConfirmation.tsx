import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BuyGoldConfirmation = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/swap?to=XAUT');
  }, [navigate]);
  
  return null;
};

export default BuyGoldConfirmation;
