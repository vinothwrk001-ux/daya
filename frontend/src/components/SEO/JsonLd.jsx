import React from "react";

export const JsonLd = ({ data }) => {
  if (!data) return null;
  return (
    <script type="application/ld+json">
      {JSON.stringify(data)}
    </script>
  );
};
