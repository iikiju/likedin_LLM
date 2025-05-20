// LLM 통합 및 회사 정보 분석 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeCompany') {
    // content.js에서 전달받은 jobDetails 사용
    analyzeCompanyWithLLM({
      name: request.companyInfo.name,
      jobDetails: request.companyInfo.description
    })
      .then(analysisResult => {
        sendResponse({ success: true, data: analysisResult });
      })
      .catch(error => {
        console.error('회사 분석 오류:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// LLM을 사용하여 회사 정보 분석
async function analyzeCompanyWithLLM(companyInfo) {
  try {
    // 회사 정보 검색
    const companyData = await searchCompanyInfo(companyInfo.name, companyInfo.jobDetails);
    
    // LLM API 호출
    const analysisResult = await callLLMApi(companyInfo, companyData);
    
    return analysisResult;
  } catch (error) {
    console.error('LLM 분석 오류:', error);
    throw error;
  }
}

// 회사 정보 검색 (외부 API 연동)
async function searchCompanyInfo(companyName, jobDetails = null) {
  try {
    // 기본 데이터
    const defaultData = {
      industry: '',
      size: '',
      averageSalary: '',
      benefits: '',
      locations: '',
      culture: '',
      name: companyName,
      jobDetails: jobDetails || ''
    };
    
    return defaultData;
  } catch (error) {
    console.error('회사 정보 검색 오류:', error);
    throw error;
  }
}

// LLM API 호출 (로컬 Ollama 사용)
async function callLLMApi(companyInfo, companyData) {
  const apiUrl = 'http://localhost:11434/api/generate';

  const jobContent = companyInfo.description || companyInfo.description || JSON.stringify(companyInfo);

const prompt = `**please remember that never the hallucination about the analysis result.
    I'm JeoungSu, a 32-year-old man, living in Busan, South Korea.
    I am currently a Software Engineer at a fintech company and am considering a job change.
    I graduated from Pusan National University with a degree in Computer Science.
    I have 5+ years of experience in backend development, proficient in Java, JavaScript, and SQL.
    I have led projects, including a payment processing system, and have experience with AWS, Docker, and API development.
    I am interested in fintech, e-commerce, or gaming industries and want to work as a Senior Software Engineer or Team Lead.
    I value a dynamic and transparent company culture that encourages collaboration and open communication.
    I am looking for a company that offers mentorship, technical training, and opportunities for career growth.
    I prefer a hybrid work model and value work-life balance with flexible hours or generous vacation policies.
    I am aiming for a salary above 80,000,000 KRW per year.
    I am open to relocating to Seoul or staying in Busan.

  The information about the company recommended to me is as follows.
  ${companyInfo.name} to ${companyInfo.jobDetails} position.
  ${jobContent}
  Compare my basic information and the company information mentioned above to analyze whether the company is a good fit for me and provide a detailed analysis of the following aspects.
=============================================================================================================================================
[Salary and Compensation]
  - 
[Benefits]
  -
[Job Fit]
  -
[Company Culture]
  - 
[Summary]
  - start sentence with "In summary, This company rating is "insert number" out of 5. This company and JeoungSu are ~"
=============================================================================================================================================
Please provide your analysis in English following the exact format above.`;

  try {
    console.log('Ollama API 호출 시작...');
    console.log('분석할 내용:', jobContent);
    
    const fetchWithTimeout = (url, options, timeout = 600000) => {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('요청 타임아웃')), timeout))
      ]);
    };
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral', // mistral, phi, tinyllama, qwen3:1.7b, qwen3:8b, 
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_ctx: 8192,
          num_thread: 8,
          repeat_penalty: 1.1
        }
      }),
    }, 600000);

    if (!response.ok) {
      throw new Error('LLM API 호출 실패');
    }

    const data = await response.json();
    let resultText = data.response || '';

    // LLM 출력 파싱
    const parseLLMResponse = (text) => {
      const sections = {
        salary: '',
        benefits: '',
        jobFit: '',
        culture: '',
        summary: '',
        rating: '' // 기본값
      };

      // 각 섹션 추출
      const salaryMatch = text.match(/\[Salary and Compensation\]([\s\S]*?)(?=\[|$)/);
      const benefitsMatch = text.match(/\[Benefits\]([\s\S]*?)(?=\[|$)/);
      const jobFitMatch = text.match(/\[Job Fit\]([\s\S]*?)(?=\[|$)/);
      const cultureMatch = text.match(/\[Company Culture\]([\s\S]*?)(?=\[|$)/);
      const summaryMatch = text.match(/\[Summary\]([\s\S]*?)(?=\[|$)/);

      if (salaryMatch) sections.salary = salaryMatch[1].trim().replace(/<\/think>/g, '');
      if (benefitsMatch) sections.benefits = benefitsMatch[1].trim().replace(/<\/think>/g, '');
      if (jobFitMatch) sections.jobFit = jobFitMatch[1].trim().replace(/<\/think>/g, '');
      if (cultureMatch) sections.culture = cultureMatch[1].trim().replace(/<\/think>/g, '');
      if (summaryMatch) sections.summary = summaryMatch[1].trim().replace(/<\/think>/g, '');

      // Summary에서 rating 추출
      if (summaryMatch) {
        const ratingMatch = summaryMatch[1].match(/rating is (\d+) out of 5/i);
        if (ratingMatch) {
          const rating = parseInt(ratingMatch[1]);
          if (!isNaN(rating) && rating >= 1 && rating <= 5) {
            sections.rating = rating;
          }
        }
      }

      return sections;
    };

    const parsedResult = parseLLMResponse(resultText);
    console.log('파싱된 결과:', parsedResult);

    return {
      name: companyInfo.name,
      salary: parsedResult.salary,
      benefits: parsedResult.benefits,
      jobFit: parsedResult.jobFit,
      culture: parsedResult.culture,
      summary: parsedResult.summary,
      rating: parsedResult.rating
    };
  } catch (error) {
    console.error('LLM API 호출 오류:', error);
    throw error;
  }
}
