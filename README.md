This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


aditya






        <table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "10px",
    fontSize: "11px",
  }}
>
  <tbody>
    <tr>
      {/* Left Column: Buyer + Consignee */}
      <td
        style={{
          border: "1px solid #000",
          padding: "4px",
          width: "50%",
          verticalAlign: "top",
          borderRight: "0px",
        }}
      >
        {/* Buyer */}
        <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
          Buyer (Bill to)
        </div>
        <div style={{ fontWeight: "bold", marginBottom: "1px" }}>
          {data.buyer.name}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          {data.buyer.address}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          GSTIN/UIN : {data.buyer.gstin}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          State Name : {data.buyer.state}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          Place of Supply : {data.buyer.placeOfSupply}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          Contact person : {data.buyer.contactPerson}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          Contact : {data.buyer.phone}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px"}}>
          E-Mail : {data.buyer.email}
        </div>
        <hr style={{width:"100%"}} />

        {/* Consignee */}
        <div style={{ fontWeight: "bold", marginBottom: "3px", marginTop: "3px" }}>
          Consignee (Ship to)
        </div>
        <div style={{ fontWeight: "bold", marginBottom: "1px" }}>
          {data.consignee.name}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          {data.consignee.address}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          GSTIN/UIN : {data.consignee.gstin}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          State Name : {data.consignee.state}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          Contact person : {data.consignee.contactPerson}
        </div>
        <div style={{ fontSize: "10px", marginBottom: "1px" }}>
          Contact : {data.consignee.phone}
        </div>
      </td>

      {/* Right Column: Empty for future use */}
      <td
        style={{
          border: "1px solid #000",
          padding: "6px",
          width: "50%",
          verticalAlign: "top",
        }}
      >
        {/* Empty space for future content */}
      </td>
    </tr>
  </tbody>
</table>