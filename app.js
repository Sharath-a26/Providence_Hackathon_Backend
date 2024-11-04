const express = require('express');

const dotenv = require('dotenv');
const bodyParser = require('body-parser');

const axios = require('axios');

dotenv.config();

var snowflake = require('snowflake-sdk')

// creating snowflake connection

const connectionPool = snowflake.createPool(
  // connection options
  {
    account: process.env.ACCOUNT,
    username: process.env.USERNAME1,
    password: process.env.PASSWORD
  },
  // pool options
  {
    max: 10, // specifies the maximum number of connections in the pool
    min: 0   // specifies the minimum number of connections in the pool
  }
);
  
  // Connect to Snowflake
  



const app = express();

app.use(bodyParser.json());

const port = 3000;

//login endpoint using username and password
app.post('/post/login',function getName(req,res) {
    // Use the connection pool and execute a statement
connectionPool.use(async (clientConnection) =>
  {   
      const {username, password} = req.body;
      const statement = await clientConnection.execute({
          sqlText: 'select * from hackathon.mock_data.patient where username = ? and password = ?;',
          binds: [username, password],
          complete: function (err, stmt, rows)
          {
            if(rows.length == 0) {
              rows[0]["error"] = 'User Not Registered';
              res.send(rows[0]);
            }
            else{
              res.send(rows[0]);
            }
          }
      });
  });
});


//get missing nutrients from gemini

async function getPatientDetails(clientConnection,patientid) {
  return new Promise((resolve, reject)=> {
    clientConnection.execute({
      sqlText: 'SELECT A.NAME,A.PATIENTID,B.DIAGNOSIS,B.PASTSURGERIES,B.ALLERGIES,B.CHRONICCONDITIONS,B.NUTRITIONALDEFICIENCIES,C.ADVICE AS DOCTOR_NUTRITION_ADVICE,D.MEDICINENAME AS MEDICATION,D.DOSAGE,D.FREQUENCY,D.MEDICATIONEFFECTSONDIET,E.SURGERYNAME,E.SURGERYDATE,E.NUTRITIONALRECOMMENDATIONS,E.PRESURGERYDIET FROM HACKATHON.MOCK_DATA.PATIENT A LEFT JOIN HACKATHON.MOCK_DATA.MEDICALHISTORY B ON A.PATIENTID = B.PATIENTID LEFT JOIN HACKATHON.MOCK_DATA.DOCTORNUTRITIONISTADVICE C ON A.PATIENTID = C.PATIENTID LEFT JOIN HACKATHON.MOCK_DATA.MEDICATION D ON A.PATIENTID = D.PATIENTID LEFT JOIN HACKATHON.MOCK_DATA.PLANNEDSURGERIES E ON A.PATIENTID = E.PATIENTID WHERE A.PATIENTID = ?',
      binds: [patientid],
     complete: function(err, stmt, rows)
      {
        
        if (err) {
          reject(err); // Reject the promise if there's an error
        } else {
          resolve(rows[0]); // Resolve the promise with the patient details
        }
        
      }
    });
  })
}


async function getPreviousMeals(clientConnection, patientid) {
  return new Promise((resolve, reject) => {
    clientConnection.execute({
      sqlText: 'SELECT * FROM HACKATHON.MOCK_DATA.DAILYDIETLOG WHERE PATIENTID = ? AND DATE = CURRENT_DATE()',
      binds: [patientid],
      complete: function(err, stmt, rows) {

        if(err) {
          reject(err);
        }
        else {
          resolve(rows[0]);
        }
      }
    });
  })
}


app.post('/post/mealdetails', function getmealdetails(req,res) {
    connectionPool.use(async (clientConnection) => {
        const {patientid, mealdetails, date, mealtype} = req.body;
        let patient_details = {};
        let previous_meals = {};

        let data1 = await getPatientDetails(clientConnection, patientid);

        
        
        
        
        
        
        
        
        // const statement1 = clientConnection.execute({
        //   sqlText: 'SELECT A.NAME,A.PATIENTID,B.DIAGNOSIS,B.PASTSURGERIES,B.ALLERGIES,B.CHRONICCONDITIONS,B.NUTRITIONALDEFICIENCIES,C.ADVICE AS DOCTOR_NUTRITION_ADVICE,D.MEDICINENAME AS MEDICATION,D.DOSAGE,D.FREQUENCY,D.MEDICATIONEFFECTSONDIET,E.SURGERYNAME,E.SURGERYDATE,E.NUTRITIONALRECOMMENDATIONS,E.PRESURGERYDIET FROM HACKATHON.MOCK_DATA.PATIENT A LEFT JOIN HACKATHON.MOCK_DATA.MEDICALHISTORY B ON A.PATIENTID = B.PATIENTID LEFT JOIN HACKATHON.MOCK_DATA.DOCTORNUTRITIONISTADVICE C ON A.PATIENTID = C.PATIENTID LEFT JOIN HACKATHON.MOCK_DATA.MEDICATION D ON A.PATIENTID = D.PATIENTID LEFT JOIN HACKATHON.MOCK_DATA.PLANNEDSURGERIES E ON A.PATIENTID = E.PATIENTID WHERE A.PATIENTID = ?',
        //   binds: [patientid],
        //  complete: function(err, stmt, rows)
        //   {
            
        //     patient_details = rows[0];
            
            
            
        //   }
        // });


        let data2 = await getPreviousMeals(clientConnection, patientid);

        

       

       
        
        let prompt_text = `Evaluate my diet for the given meal, considering my medical conditions and the previous meals consumed throughout the day. The input will include the current planned meal and details of prior meals to ensure a comprehensive nutritional assessment. In the nutritional assessment also consider the planned surgeries.Your response should include the following:



FOODITEMS: List all food items consumed in the current meal.

NUTRIENTSCONSUMED: Summarize the key nutrients already consumed from this meal.

MISSINGNUTRIENTS: Identify any nutrients still lacking after considering the current and previous meals.

MEALDIETSCORE: Rate the overall nutritional quality of the current meal out of 10, considering the day's dietary intake. The value should just be 8 or 9 but not 8/10, I mean no need of denominator

APPROXIMATECALORIECOUNT: Provide an estimate of the total calories for the current meal and how it fits into the daily intake.

ISDIETMEDICALHISTORYCOMPLIANT: Assess if the overall diet, including the current meal and previous meal of the day, aligns with my medical conditions.

FOODTOAVOID: Recommend any food item from the current meal to avoid, based on medical risk factors.

FOODAFFECTEDBYMEDICATION: Identify any food that may interact with medication, and suggest alternatives or remedies.

BETTERTOADDINTHEDIET: Recommend specific foods or nutrients to include in the rest of the day's meals to achieve a balanced diet, based on the cuisine choices available from the input data.

Input details will include the current meal plan along with prior meals of the day. Conduct the evaluation based on the nutrients consumed, highlight the missing nutrients, and make food recommendations accordingly.



Current meal : ${mealtype}



${mealdetails}


Also, provide ingredient-level details, factor in medical advice, medication impacts, and any upcoming surgical dietary requirements as part of your assessment.


patient details:


${JSON.stringify(data1)}


previous meals of the day


${JSON.stringify(data2)}
`

        
        
        
        const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCcvPfgez4w6J7Ze9--BROhrxD3TtTJObU', {
          "contents":[
        {
            "parts":[{"text": prompt_text}]
        }
    ]
        });
        
        
        res.send(response.data);
    }
    );
});


app.post('/post/finalizemealdetails', function getmealdetails(req,res) {
  connectionPool.use(async (clientConnection) => {
      const {patientid, mealdetails, date, mealtype} = req.body;
      let patient_details = {};
      let previous_meals = {};

      let data1 = await getPatientDetails(clientConnection, patientid);


      let data2 = await getPreviousMeals(clientConnection, patientid);

      

     

     
      
      let prompt_text = `Evaluate my diet for the given meal, considering my medical conditions and the previous meals consumed throughout the day. The input will include the current planned meal and details of prior meals to ensure a comprehensive nutritional assessment. In the nutritional assessment also consider the planned surgeries.Your response should include the following:



FOODITEMS: List all food items consumed in the current meal.

NUTRIENTSCONSUMED: Summarize the key nutrients already consumed from this meal.

MISSINGNUTRIENTS: Identify any nutrients still lacking after considering the current and previous meals.

MEALDIETSCORE: Rate the overall nutritional quality of the current meal out of 10, considering the day's dietary intake. The value should just be 8 or 9 but not 8/10, I mean no need of denominator

APPROXIMATECALORIECOUNT: Provide an estimate of the total calories for the current meal and how it fits into the daily intake.

ISDIETMEDICALHISTORYCOMPLIANT: Assess if the overall diet, including the current meal and previous meal of the day, aligns with my medical conditions.

FOODTOAVOID: Recommend any food item from the current meal to avoid, based on medical risk factors.

FOODAFFECTEDBYMEDICATION: Identify any food that may interact with medication, and suggest alternatives or remedies.

BETTERTOADDINTHEDIET: Recommend specific foods or nutrients to include in the rest of the day's meals to achieve a balanced diet, based on the cuisine choices available from the input data.

Input details will include the current meal plan along with prior meals of the day. Conduct the evaluation based on the nutrients consumed, highlight the missing nutrients, and make food recommendations accordingly.



Current meal : ${mealtype}



${mealdetails}


Also, provide ingredient-level details, factor in medical advice, medication impacts, and any upcoming surgical dietary requirements as part of your assessment.


patient details:


${JSON.stringify(data1)}


previous meals of the day


${JSON.stringify(data2)}

create a insert script for the below table using the above information. Providing the table definition. Make the insert like food item : evaluation in short.
create or replace TABLE HACKATHON.MOCK_DATA.DAILYDIETLOG (
	LOGID NUMBER(38,0) NOT NULL autoincrement start 1 increment 1 noorder,
	PATIENTID NUMBER(38,0),
	DATE DATE,
	MEAL VARCHAR(50),
	FOODITEMS VARCHAR(255),
	NUTRIENTSCONSUMED VARCHAR(255),
	MISSINGNUTRIENTS VARCHAR(255),
	MEALDIETSCORE VARCHAR(16777216),
	APPROXIMATECALORIECOUNT VARCHAR(16777216),
	ISDIETMEDICALHISTORYCOMPLIANT VARCHAR(16777216),
	FOODTOAVOID VARCHAR(16777216),
	FOODAFFECTEDBYMEDICATION VARCHAR(16777216),
	BETTETTOADDINTHEDIET VARCHAR(16777216),
	primary key (LOGID)
);

Give only the insert script without any extra strings in a single line as a text output not a code output
`

      
      
      
      const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCcvPfgez4w6J7Ze9--BROhrxD3TtTJObU', {
        "contents":[
      {
          "parts":[{"text": prompt_text}]
      }
  ]
      });
      
      let a = response.data["candidates"][0]["content"]["parts"][0]["text"]
      let b = a.replace(/\n/g, '');

      const statement1 = await clientConnection.execute({
          sqlText: b,
          binds: [patientid],
         complete: function(err, stmt, rows)
          {
            
            
            if(err){
              console.log(err);
            }

            else {

              console.log('Insertion Successful');
              res.send("Inserted into Diet Successfully");
            }
            
            
          }
        });



  }
  );
});


async function getDates(clientConnection, patientid) {
  return new Promise((resolve, reject) => {
    clientConnection.execute({
      sqlText: 'SELECT DISTINCT DATE FROM HACKATHON.MOCK_DATA.DAILYDIETLOG WHERE PATIENTID = 1',
      binds: [patientid],
      complete: function(err, stmt, rows) {

        if(err) {
          reject(err);
        }
        else {
          resolve(rows);
        }
      }
    });
  })
}

app.post('/post/distinctdates', function getdistinctdates(req,res) {
  connectionPool.use(async (clientConnection) => {
      const {patientid} = req.body;

      let data1 = await getDates(clientConnection, patientid);

      console.log(data1[0]["DATE"].toString());
      
      
      
      res.send(data1);

  });
});

async function getDietForDay(clientConnection, patientid, date) {
  return new Promise((resolve, reject) => {
    clientConnection.execute({
      sqlText: "SELECT PATIENTID,DATE,LISTAGG(CONCAT(MEAL, ' : ', FOODITEMS, '; ')) AS DIET_TAKEN,AVG(MEALDIETSCORE) AS AVERAGE_SCORE,LISTAGG(CONCAT(MEAL, ' : ', APPROXIMATECALORIECOUNT, '; ')) AS CALORIES,LISTAGG(CONCAT(MEAL, ' : ', NUTRIENTSCONSUMED, '; ')) AS NUTRIENTSCONSUMED,LISTAGG(CONCAT(MEAL, ' : ', MISSINGNUTRIENTS, '; ')) AS MISSINGNUTRIENTS,LISTAGG(CONCAT(MEAL, ' : ', ISDIETMEDICALHISTORYCOMPLIANT, '; ')) AS ISDIETMEDICALHISTORYCOMPLIANT,LISTAGG(CONCAT(MEAL, ' : ', FOODTOAVOID, '; ')) AS FOODTOAVOID,LISTAGG(CONCAT(MEAL, ' : ', FOODAFFECTEDBYMEDICATION, '; ')) AS FOODAFFECTEDBYMEDICATION,LISTAGG(CONCAT(MEAL, ' : ', BETTETTOADDINTHEDIET, '; ')) AS BETTETTOADDINTHEDIET FROM HACKATHON.MOCK_DATA.DAILYDIETLOG GROUP BY PATIENTID, DATE HAVING PATIENTID = ? AND DATE = ?",
      binds: [patientid, date],
      complete: function(err, stmt, rows) {

        if(err) {
          reject(err);
        }
        else {

          resolve(rows[0]);
        }
      }
    });
  })
}

app.post('/post/hello', function hello(req,res) {
  console.log("hello");
  res.send("hello");
  
})

app.post('/post/daydietlog', function getdaylogs(req,res) {
  connectionPool.use(async (clientConnection) => {

    console.log("Hitting server");
    const {patientid, date} = req.body;

    let data1 = await getDietForDay(clientConnection, patientid, date);

    console.log('Daily logs fetched');
    
    
    
    res.send(data1);

});
}) 

const host = '0.0.0.0';
app.listen(port,host, () => {
    console.log(`Server running on port ${port}`);
   
    
    
    
})

