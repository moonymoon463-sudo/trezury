import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SellGoldConfirmation = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/swap');
  }, [navigate]);
  
  return null;
};

export default SellGoldConfirmation;
