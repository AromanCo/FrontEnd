import React, { useEffect, useState } from "react";

const Home = () => {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    const fetchProtectedData = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setMessage("No token found. Please log in.");
        return;
      }

      try {
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
      } catch (error) {
        setMessage("Error fetching data.");
        console.error("Fetch error:", error);
      }
    };

    fetchProtectedData();
  }, []);

  return <div>{message} Aroman</div>;
};

export default Home;
