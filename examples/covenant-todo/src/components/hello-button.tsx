"use client";
import { covenantClient } from "@/lib/client";


export function HelloButton() {

  const onClick = async () => {
    const res = await covenantClient.query("helloWorld", {
      name: "Jonathan",
    });

    if (res.result === "OK") {
      console.log(res.data);
    } else {
      console.log(`Error ${res.error}`);
    }

  }

  return (
    <button 
      className="bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue:400 p-8 m-4"
      onClick={onClick}
    >
      Say Hello
    </button>
  )
}
