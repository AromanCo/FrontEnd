import React, { useEffect, useState } from "react";

const Home = () => {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    const fetchProtectedData = async () => {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:8080/api/protected", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage("You are authenticated!");
      } else {
        setMessage("You are not authenticated.");
      }
    };

    fetchProtectedData();
  }, []);

  return <div>{`${message} Aroman`}</div>;
};

export default Home;
