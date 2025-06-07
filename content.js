// LinkedIn 페이지에 회사 분석 버튼 추가
document.addEventListener('DOMContentLoaded', () => {
  console.log('LinkedIn 회사 분석기 로드됨');
  
  // iframe 내부에서 실행 중인지 확인
  const isInIframe = window.self !== window.top;
  console.log('iframe 내부 실행 여부:', isInIframe);
  
  // 메인 프레임에서만 버튼 추가
  if (!isInIframe) {
    // 페이지 로드 후 즉시 버튼 추가 시도
    addAnalysisButtons();

    // 동적 콘텐츠에 대응하기 위한 MutationObserver 설정
    const observer = new MutationObserver((mutations) => {
      console.log('DOM 변경 감지');
      addAnalysisButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
});

// LinkedIn 메시지 리스너 (팝업과의 통신)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('메시지 수신:', request);
  
  // iframe 내부에서 실행 중인지 확인
  const isInIframe = window.self !== window.top;
  if (isInIframe) {
    console.log('iframe 내부에서 메시지 수신, 상위 프레임으로 전달');
    // 상위 프레임으로 메시지 전달
    window.parent.postMessage(request, '*');
    return true;
  }
  
  if (request.action === 'checkCompanyInfo') {
    // 현재 페이지에서 모든 회사 정보 추출
    const companiesInfo = extractAllCompaniesInfo();
    console.log('추출된 모든 회사 정보:', companiesInfo);
    sendResponse({ companiesInfo: companiesInfo });
  } else if (request.action === 'analyzeSelectedCompany') {
    // 특정 회사 정보 찾기
    const companyName = request.companyName;
    const companyInfo = findCompanyInfo(companyName);
    if (companyInfo) {
      console.log('선택된 회사 분석 요청:', companyInfo);
      sendResponse({ success: true, companyInfo: companyInfo });
    } else {
      sendResponse({ success: false, error: '회사 정보를 찾을 수 없습니다.' });
    }
  } else if (request.action === 'getCompanyInfo') {
    console.log('회사 정보 요청:', request.companyName);
    const companyInfo = extractCompanyInfo();
    
    if (companyInfo.name === request.companyName) {
      console.log('회사 정보 전송:', companyInfo);
      sendResponse({ success: true, companyInfo });
    } else {
      console.log('회사 정보 불일치');
      sendResponse({ success: false, error: '회사 정보를 찾을 수 없습니다.' });
    }
  } else if (request.action === 'extractProfileInfo') {
    console.log('프로필 정보 추출 요청 수신');
    try {
      // 프로필 정보 추출
      const profileInfo = extractProfileInfo();
      console.log('추출된 프로필 정보:', profileInfo);
      sendResponse(profileInfo);
    } catch (error) {
      console.error('프로필 정보 추출 중 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'extractGlassdoorInfo') {
    extractGlassdoorInfo(request.companyName)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 비동기 응답을 위해 true 반환
  }
  return true; // 비동기 응답을 위해 true 반환
});

// 특정 회사 정보 찾기
function findCompanyInfo(companyName) {
  const companiesInfo = extractAllCompaniesInfo();
  return companiesInfo.find((company) => company.name === companyName) || null;
}

// 현재 페이지에서 모든 회사 정보 추출
function extractAllCompaniesInfo() {
  console.log('모든 회사 정보 추출 시도');
  const companies = [];

  // 1. 채용 공고의 회사 정보 (메인 페이지의 회사)
  const mainCompanyElement = document.querySelector(
    '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .org-top-card-summary__title'
  );
  if (mainCompanyElement) {
    const companyName = mainCompanyElement.textContent.trim();
    const companyDescription = extractCompanyDescription();
    companies.push({
      name: companyName,
      url: window.location.href,
      isCurrent: true,
      description: companyDescription,
      industry: extractIndustryInfo(companyName),
    });
  }

  // 2. 회사 검색 결과 및 채용 카드
  const companyElements = document.querySelectorAll(
    '.entity-result__title-text, .job-card-container, .company-name, .job-card-list__title, .org-top-card-summary__title'
  );
  companyElements.forEach((element) => {
    const companyNameElement = element.querySelector('a, span') || element;
    if (companyNameElement) {
      const companyName = companyNameElement.textContent.trim();
      if (companyName && !companies.some((c) => c.name === companyName)) {
        companies.push({
          name: companyName,
          url: companyNameElement.href || window.location.href,
          isCurrent: false,
          description: '',
          industry: extractIndustryInfo(companyName),
        });
      }
    }
  });

  // 3. 고정된 채용 목록 (왼쪽 사이드바)
  const leftPanelJobs = document.querySelectorAll('.jobs-search-results-list__list-item');
  leftPanelJobs.forEach((jobItem) => {
    const companyElement = jobItem.querySelector(
      '.job-card-container__company-name, .job-card-container__primary-description'
    );
    if (companyElement) {
      const companyName = companyElement.textContent.trim();
      if (companyName && !companies.some((c) => c.name === companyName)) {
        companies.push({
          name: companyName,
          url: window.location.href,
          isCurrent: false,
          description: '',
          industry: extractIndustryInfo(companyName),
        });
      }
    }
  });

  // 4. 현재 보고 있는 채용 공고 세부 정보
  const jobDetailCompany = document.querySelector(
    '.jobs-unified-top-card__company-name, .topcard__org-name-link'
  );
  if (jobDetailCompany) {
    const companyName = jobDetailCompany.textContent.trim();
    if (companyName && !companies.some((c) => c.name === companyName)) {
      companies.push({
        name: companyName,
        url: window.location.href,
        isCurrent: true,
        description: extractCompanyDescription(),
        industry: extractIndustryInfo(companyName),
      });
    }
  }

  // 5. 이미 스크립트에서 찾은 회사명 요소
  const elementsWithCompany = document.querySelectorAll('[data-analysis-added="true"]');
  elementsWithCompany.forEach((element) => {
    const companyName = element.textContent.trim().replace('분석', '').trim();
    if (companyName && !companies.some((c) => c.name === companyName)) {
      companies.push({
        name: companyName,
        url: window.location.href,
        isCurrent: false,
        description: '',
        industry: extractIndustryInfo(companyName),
      });
    }
  });

  // 중복 제거
  const uniqueCompanies = [];
  companies.forEach((company) => {
    if (!uniqueCompanies.some((c) => c.name === company.name)) {
      uniqueCompanies.push(company);
    }
  });

  console.log('추출된 회사 수:', uniqueCompanies.length);
  return uniqueCompanies;
}

// 회사 설명 추출
function extractCompanyDescription() {
  try {
    const jobInfo = {
      title: '',
      company: '',
      location: '',
      fullText: '',
    };

    console.log('=== 채용 정보 추출 시작 ===');

    const jobTitleElement = document.querySelector(
      '.jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title'
    );
    if (jobTitleElement) {
      jobInfo.title = jobTitleElement.textContent.trim();
      console.log('직무 제목 추출:', jobInfo.title);
    }

    const companyElement = document.querySelector(
      '.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name'
    );
    if (companyElement) {
      jobInfo.company = companyElement.textContent.trim();
      console.log('회사명 추출:', jobInfo.company);
    }

    const locationElement = document.querySelector(
      '.jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__bullet'
    );
    if (locationElement) {
      jobInfo.location = locationElement.textContent.trim();
      console.log('위치 정보 추출:', jobInfo.location);
    }

    // 전체 텍스트 가져오기
    jobInfo.fullText = document.body.innerText.trim();
    
    // "How can I best position myself for this job?" 이후의 내용 추출
    const targetPhrase = 'How can I best position myself for this job?';
    let mainContent = '';
    
    const index = jobInfo.fullText.indexOf(targetPhrase);
    if (index !== -1) {
      console.log('타겟 문구 찾음');
      mainContent = jobInfo.fullText.substring(index + targetPhrase.length).trim();
      
      // 다음 섹션 시작 전까지만 내용 추출
      const nextSectionMarkers = [
        'Requirements',
        'Qualifications',
        'Benefits',
        'Perks',
        'Responsibilities',
        'About the company',
        'Additional information'
      ];
      
      for (const marker of nextSectionMarkers) {
        const nextIndex = mainContent.indexOf(marker);
        if (nextIndex !== -1) {
          mainContent = mainContent.substring(0, nextIndex).trim();
          break;
        }
      }
    } else {
      console.log('타겟 문구를 찾을 수 없음, 전체 텍스트 사용');
      mainContent = jobInfo.fullText;
    }

    const description = `
채용 공고 정보:
제목: ${jobInfo.title}
회사: ${jobInfo.company}
위치: ${jobInfo.location}

채용 공고 내용:
${mainContent}
    `;

    console.log('=== 채용 정보 추출 완료 ===');
    return description.trim();
  } catch (error) {
    console.error('채용 정보 추출 오류:', error);
    return document.body.innerText.trim();
  }
}

// 다음 섹션인지 확인하는 함수
function isNextSection(element) {
  if (!element) return true;

  const sectionTags = ['H2', 'H3', 'H4', 'H5', 'H6'];
  if (sectionTags.includes(element.tagName)) return true;

  if (element.tagName === 'STRONG' || element.tagName === 'B') {
    const text = element.textContent.trim().toLowerCase();
    const sectionKeywords = ['requirements', 'qualifications', 'benefits', 'perks', 'responsibilities'];
    return sectionKeywords.some((keyword) => text.includes(keyword));
  }

  return false;
}

// 특정 섹션 찾기
function findSection(...sectionNames) {
  for (const name of sectionNames) {
    const sectionHeader = Array.from(document.querySelectorAll('h2, h3, h4, h5, h6, strong, b')).find(
      (element) => element.textContent.trim().toLowerCase().includes(name.toLowerCase())
    );

    if (sectionHeader) {
      let content = '';
      let currentElement = sectionHeader.nextElementSibling;

      while (currentElement && !isNextSection(currentElement)) {
        if (currentElement.textContent.trim()) {
          content += currentElement.textContent.trim() + '\n';
        }
        currentElement = currentElement.nextElementSibling;
      }

      if (content.trim()) return content.trim();
    }
  }
  return null;
}

// 산업 정보 추출
function extractIndustryInfo(companyName) {
  const industryElement = document.querySelector('.org-top-card-summary-info-list__info-item');
  if (industryElement) return industryElement.textContent.trim();

  const companyInfoElements = document.querySelectorAll('.jobs-company__box p');
  for (const element of companyInfoElements) {
    if (element.textContent.includes('Industry') || element.textContent.includes('산업')) {
      return element.textContent.split(':')[1]?.trim() || '';
    }
  }

  return '';
}

// 회사 정보 추출 함수
function extractCompanyInfo() {
  console.log('회사 정보 추출 함수 실행');
  
  const companyInfo = {
    name: '',
    industry: '',
    description: '',
    size: '',
    founded: '',
    headquarters: '',
    specialties: [],
    website: '',
    followers: '',
    employees: []
  };

  // 회사명 추출
  const nameElement = document.querySelector('.org-top-card-summary__title, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
  if (nameElement) {
    companyInfo.name = nameElement.textContent.trim();
  }

  // 산업 정보 추출
  const industryElement = document.querySelector('.org-top-card-summary-info-list__info-item');
  if (industryElement) {
    companyInfo.industry = industryElement.textContent.trim();
  }

  // 회사 설명 추출
  const descriptionElement = document.querySelector('.org-about-us-organization-description__text');
  if (descriptionElement) {
    companyInfo.description = descriptionElement.textContent.trim();
  }

  // 회사 규모 추출
  const sizeElement = document.querySelector('.org-about-company-module__company-size-definition-text');
  if (sizeElement) {
    companyInfo.size = sizeElement.textContent.trim();
  }

  // 설립일 추출
  const foundedElement = document.querySelector('.org-about-company-module__founded');
  if (foundedElement) {
    companyInfo.founded = foundedElement.textContent.trim();
  }

  // 본사 위치 추출
  const headquartersElement = document.querySelector('.org-about-company-module__headquarters');
  if (headquartersElement) {
    companyInfo.headquarters = headquartersElement.textContent.trim();
  }

  // 전문 분야 추출
  const specialtiesElements = document.querySelectorAll('.org-about-company-module__specialities-item');
  if (specialtiesElements.length > 0) {
    companyInfo.specialties = Array.from(specialtiesElements).map(el => el.textContent.trim());
  }

  // 웹사이트 추출
  const websiteElement = document.querySelector('.org-about-us-company-module__website');
  if (websiteElement) {
    companyInfo.website = websiteElement.href;
  }

  // 팔로워 수 추출
  const followersElement = document.querySelector('.org-top-card-summary-info-list__info-item--followers');
  if (followersElement) {
    companyInfo.followers = followersElement.textContent.trim();
  }

  // 주요 직원 정보 추출
  const employeeElements = document.querySelectorAll('.org-people-profile-card');
  if (employeeElements.length > 0) {
    companyInfo.employees = Array.from(employeeElements).map(el => ({
      name: el.querySelector('.org-people-profile-card__profile-title')?.textContent.trim() || '',
      title: el.querySelector('.org-people-profile-card__profile-position')?.textContent.trim() || '',
      image: el.querySelector('.org-people-profile-card__profile-image')?.src || ''
    }));
  }

  console.log('추출된 회사 정보:', companyInfo);
  return companyInfo;
}

// 선택자에서 텍스트 추출
function extractFromSelector(selector) {
  const element = document.querySelector(selector);
  return element ? element.textContent.trim() : null;
}

// LinkedIn 회사 요소에 분석 버튼 추가
function addAnalysisButtons() {
  console.log('분석 버튼 추가 시도');
  
  // 기존 분석 버튼 찾기 (더 구체적인 선택자 사용)
  const existingButtons = document.querySelectorAll('button.linkedin-analyzer-btn');
  console.log('기존 분석 버튼 수:', existingButtons.length);
  
  if (existingButtons.length === 0) {
    console.log('분석 버튼을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }
  
  existingButtons.forEach((button, index) => {
    console.log(`처리 중인 버튼 ${index + 1}:`, button.outerHTML);
    
    // 이미 회사 정보 버튼이 추가된 버튼은 건너뛰기
    if (button.nextElementSibling && button.nextElementSibling.classList.contains('linkedin-analyzer-btn')) {
      console.log('이미 회사 정보 버튼이 있는 버튼 건너뛰기');
      return;
    }
    
    // 회사명 찾기 (여러 방법 시도)
    let companyName = '';
    
    // 1. data-analysis-added 속성이 있는 가장 가까운 부모 요소에서 찾기
    const parentWithData = button.closest('[data-analysis-added="true"]');
    if (parentWithData) {
      companyName = parentWithData.textContent.trim().replace('분석', '').trim();
      console.log('data-analysis-added에서 찾은 회사명:', companyName);
    }
    
    // 2. 회사명이 있는 일반적인 요소에서 찾기
    if (!companyName) {
      const companyElements = document.querySelectorAll('.org-top-card-summary__title, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
      for (const element of companyElements) {
        const text = element.textContent.trim();
        if (text && !text.includes('분석')) {
          companyName = text;
          console.log('일반 요소에서 찾은 회사명:', companyName);
          break;
        }
      }
    }
    
    if (!companyName) {
      console.log('회사명을 찾을 수 없음');
      return;
    }
    
    const companyInfoButton = document.createElement('button');
    companyInfoButton.className = 'linkedin-analyzer-btn';
    companyInfoButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      회사 정보
    `;

    companyInfoButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const companyInfo = {
        name: companyName,
        url: window.location.href,
        description: extractCompanyDescription(),
        industry: extractIndustryInfo(companyName),
      };

      console.log('회사 정보 요청:', companyInfo);
      showCompanyInfoCard(companyInfo, e.target);
    });

    // 분석 버튼 다음에 회사 정보 버튼 추가
    button.parentNode.insertBefore(companyInfoButton, button.nextSibling);
    console.log('회사 정보 버튼 추가됨:', companyName);
  });
}

// 버튼을 삽입할 컨테이너 요소 찾기
function findButtonContainer(element) {
  console.log('컨테이너 찾기 시작:', element.outerHTML);
  
  // 1. 부모 요소 중에서 적절한 컨테이너 찾기
  let container = element.parentElement;
  while (container) {
    console.log('검사 중인 컨테이너:', container.outerHTML);
    
    // 이미 버튼이 있는 컨테이너인지 확인
    if (container.querySelector('.linkedin-analyzer-btn')) {
      console.log('기존 버튼이 있는 컨테이너 발견');
      return container;
    }
    
    // 적절한 컨테이너인지 확인
    if (container.classList.contains('org-top-card-summary__title') ||
        container.classList.contains('job-details-jobs-unified-top-card__company-name') ||
        container.classList.contains('jobs-unified-top-card__company-name') ||
        container.classList.contains('entity-result__title-text') ||
        container.classList.contains('job-card-container') ||
        container.classList.contains('company-name') ||
        container.classList.contains('feed-shared-actor__meta') ||
        container.classList.contains('artdeco-entity-lockup__title') ||
        container.classList.contains('job-card-container__company-name')) {
      console.log('적절한 컨테이너 발견');
      return container;
    }
    
    container = container.parentElement;
  }
  
  // 2. 적절한 컨테이너를 찾지 못한 경우, 새로운 컨테이너 생성
  console.log('새 컨테이너 생성');
  const newContainer = document.createElement('div');
  newContainer.style.display = 'inline-flex';
  newContainer.style.alignItems = 'center';
  newContainer.style.gap = '8px';
  
  // 원래 요소를 새 컨테이너로 감싸기
  element.parentNode.insertBefore(newContainer, element);
  newContainer.appendChild(element);
  
  return newContainer;
}

// 회사 분석 정보 카드 표시
function showAnalysisCard(companyInfo, targetElement) {
  const existingCard = document.querySelector('.company-analysis-card');
  if (existingCard) existingCard.remove();

  const card = document.createElement('div');
  card.className = 'company-analysis-card';
  card.innerHTML = `
    <button class="close-btn">×</button>
    <h2>${companyInfo.name}</h2>
    <div class="analysis-loading">
      <div class="spinner"></div>
      <p>페이지 정보를 분석 중입니다...</p>
    </div>
    <div class="company-details" style="margin-top: 10px; font-size: 12px; color: #666;">
      ${companyInfo.industry ? `<p><strong>산업:</strong> ${companyInfo.industry}</p>` : ''}
    </div>
  `;

  card.querySelector('.close-btn').addEventListener('click', () => card.remove());

  document.body.appendChild(card);

  const buttonRect = targetElement.getBoundingClientRect();
  card.style.top = `${buttonRect.bottom + window.scrollY}px`;
  card.style.left = `${buttonRect.left + window.scrollX}px`;

  console.log('분석 카드 표시됨, 백그라운드 요청 시작');

  const jobDetails = extractCompanyDescription();

  chrome.runtime.sendMessage(
    {
      action: 'analyzeCompany',
      companyInfo: { ...companyInfo, jobDetails },
    },
    (response) => {
      if (response && response.success) {
        console.log('분석 결과 수신:', response.data);
        updateAnalysisCard(card, response.data);
      } else {
        console.error('분석 오류:', response);
        showAnalysisError(card);
      }
    }
  );
}

// 분석 결과로 카드 업데이트
function updateAnalysisCard(card, analysisData) {
  let cardHTML = `
    <button class="close-btn">×</button>
    <h2>${analysisData.name}</h2>
    <div class="analysis-section">
      <h3>연봉 정보</h3>
      <p>${analysisData.salary || '정보 없음'}</p>
      ${generateStars(analysisData.salary_score || 0)}
    </div>
    <div class="analysis-section">
      <h3>복지 정보</h3>
      <p>${analysisData.benefits || '정보 없음'}</p>
      ${generateStars(analysisData.benefits_score || 0)}
    </div>
    <div class="analysis-section">
      <h3>직무 적합도</h3>
      <p>${analysisData.jobFit || '정보 없음'}</p>
      ${generateStars(analysisData.jobFit_score || 0)}
    </div>
  `;

  if (analysisData.culture) {
    cardHTML += `
      <div class="analysis-section">
        <h3>회사 문화</h3>
        <p>${analysisData.culture}</p>
        ${generateStars(analysisData.culture_score || 0)}
      </div>
    `;
  }

  if (analysisData.growth) {
    cardHTML += `
      <div class="analysis-section">
        <h3>성장 기회</h3>
        <p>${analysisData.growth}</p>
        ${generateStars(analysisData.growth_score || 0)}
      </div>
    `;
  }

  cardHTML += `
    <div class="analysis-section">
      <h3>종합 평가</h3>
      <div class="stars">${generateStars(analysisData.rating)}</div>
      <p>${analysisData.summary || '정보 없음'}</p>
    </div>
  `;

  card.innerHTML = cardHTML;
  card.querySelector('.close-btn').addEventListener('click', () => card.remove());
}

// 별점 HTML 생성
function generateStars(rating) {
  rating = parseInt(rating) || 0;
  let starsHtml = '<div class="stars">';
  for (let i = 1; i <= 5; i++) {
    starsHtml += i <= rating ? '<span class="star active">★</span>' : '<span class="star">★</span>';
  }
  starsHtml += '</div>';
  return starsHtml;
}

// 분석 오류 표시
function showAnalysisError(card) {
  card.innerHTML = `
    <button class="close-btn">×</button>
    <h2>분석 오류</h2>
    <p>분석 중 오류가 발생했습니다. 다시 시도해 주세요.</p>
  `;
  card.querySelector('.close-btn').addEventListener('click', () => card.remove());
}

// About the job 섹션 찾기
function findAboutJobSection() {
  try {
    const selectors = [
      'h2.text-heading-large',
      'h2.jobs-box__subtitle',
      'h2.jobs-description__job-subtitle',
      'h2.jobs-box__subtitle--large',
      'strong:contains("About the job")',
      'b:contains("About the job")',
      'h2:contains("About the job")',
      'h3:contains("About the job")',
      'h4:contains("About the job")',
    ];

    for (const selector of selectors) {
      const sectionHeader = document.querySelector(selector);
      if (sectionHeader) {
        let content = '';
        let currentElement = sectionHeader.nextElementSibling;

        while (currentElement && !isNextSection(currentElement)) {
          if (currentElement.textContent.trim()) {
            content += currentElement.textContent.trim() + '\n';
          }
          currentElement = currentElement.nextElementSibling;
        }

        if (content.trim()) return content.trim();
      }
    }

    const allElements = document.querySelectorAll('h2, h3, h4, h5, h6, strong, b');
    for (const element of allElements) {
      const text = element.textContent.trim().toLowerCase();
      if (text.includes('about the job') || text.includes('about this job')) {
        let content = '';
        let currentElement = element.nextElementSibling;

        while (currentElement && !isNextSection(currentElement)) {
          if (currentElement.textContent.trim()) {
            content += currentElement.textContent.trim() + '\n';
          }
          currentElement = currentElement.nextElementSibling;
        }

        if (content.trim()) return content.trim();
      }
    }

    return null;
  } catch (error) {
    console.error('About the job 섹션 추출 오류:', error);
    return null;
  }
}

function isEnglish(text) {
  return /^[\x00-\x7F]*$/.test(text.replace(/\s/g, ''));
}

// 페이지를 맨 아래까지 스크롤하는 함수
async function scrollToBottom() {
  return new Promise((resolve) => {
    let lastScrollHeight = 0;
    const scrollInterval = setInterval(() => {
      window.scrollTo(0, document.body.scrollHeight);
      
      // 스크롤이 더 이상 내려가지 않으면 종료
      if (document.body.scrollHeight === lastScrollHeight) {
        clearInterval(scrollInterval);
        // 잠시 대기 후 resolve
        setTimeout(resolve, 1000);
      }
      lastScrollHeight = document.body.scrollHeight;
    }, 500);
  });
}

// 프로필 정보 추출 함수 수정
async function extractProfileInfo() {
  console.log('프로필 정보 추출 시작');
  
  try {
    // 페이지를 맨 아래까지 스크롤
    await scrollToBottom();
    console.log('페이지 스크롤 완료');

    // DOM 구조 디버깅
    console.log('=== DOM 구조 디버깅 ===');
    console.log('전체 프로필 섹션:', document.querySelector('.scaffold-layout__main')?.outerHTML);
    console.log('이름 요소:', document.querySelector('h1.text-heading-xlarge')?.outerHTML);
    console.log('직함 요소:', document.querySelector('.text-body-medium.break-words')?.outerHTML);
    console.log('경력 섹션:', document.querySelector('section#experience')?.outerHTML);
    console.log('학력 섹션:', document.querySelector('section#education')?.outerHTML);
    console.log('기술 섹션:', document.querySelector('section#skills')?.outerHTML);

    const profileInfo = {
      name: '',
      title: '',
      company: '',
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      skills: []
    };

    // 기본 정보 추출
    const nameElement = document.querySelector('h1.text-heading-xlarge span[aria-hidden="true"], .inline.t-24.v-align-middle.break-words span[aria-hidden="true"]');
    console.log('이름 요소 찾음:', nameElement?.outerHTML);
    if (nameElement) {
      profileInfo.name = nameElement.textContent.trim();
      console.log('이름 추출:', profileInfo.name);
    }

    // 직함과 회사 정보 추출
    const titleSpans = document.querySelectorAll('.text-body-medium.break-words span[aria-hidden="true"], .pv-text-details__left-panel .text-body-medium span[aria-hidden="true"]');
    console.log('직함 요소들 찾음:', titleSpans.length, Array.from(titleSpans).map(el => el.outerHTML));
    if (titleSpans.length > 0) {
      const titleParts = Array.from(titleSpans)
        .map(span => span.textContent.trim())
        .filter(text => text && text !== '·')
        .join(' ');
      
      if (titleParts) {
        const parts = titleParts.split('·').map(part => part.trim());
        if (parts.length > 0) {
          profileInfo.company = parts[0];
          if (parts.length > 1) {
            profileInfo.title = parts[1];
          }
        }
      }
      console.log('회사/직함 추출:', { company: profileInfo.company, title: profileInfo.title });
    }

    // 경력 정보 추출
    const experienceSection = document.querySelector('section#experience, section[data-section="experience"]');
    console.log('경력 섹션 찾음:', experienceSection?.outerHTML);
    if (experienceSection) {
      const experienceItems = experienceSection.querySelectorAll('.pvs-list__item--line-separated, .pvs-entity--padded');
      console.log('경력 항목들 찾음:', experienceItems.length);
      experienceItems.forEach((item, index) => {
        console.log(`경력 항목 ${index + 1}:`, item.outerHTML);
        const spans = item.querySelectorAll('span[aria-hidden="true"]');
        console.log(`경력 항목 ${index + 1}의 span들:`, Array.from(spans).map(el => el.outerHTML));
        const textParts = Array.from(spans)
          .map(span => span.textContent.trim())
          .filter(text => text);

        if (textParts.length > 0) {
          const experience = {
            title: textParts[0] || '',
            company: textParts[1] || '',
            period: textParts[2] || '',
            description: textParts.slice(3).join(' ') || ''
          };
          profileInfo.experience.push(experience);
          console.log('경력 정보 추출:', experience);
        }
      });
    }

    // 학력 정보 추출
    const educationSection = document.querySelector('section#education, section[data-section="education"]');
    console.log('학력 섹션 찾음:', educationSection?.outerHTML);
    if (educationSection) {
      const educationItems = educationSection.querySelectorAll('.pvs-list__item--line-separated, .pvs-entity--padded');
      console.log('학력 항목들 찾음:', educationItems.length);
      educationItems.forEach((item, index) => {
        console.log(`학력 항목 ${index + 1}:`, item.outerHTML);
        const spans = item.querySelectorAll('span[aria-hidden="true"]');
        console.log(`학력 항목 ${index + 1}의 span들:`, Array.from(spans).map(el => el.outerHTML));
        const textParts = Array.from(spans)
          .map(span => span.textContent.trim())
          .filter(text => text);

        if (textParts.length > 0) {
          const education = {
            school: textParts[0] || '',
            degree: textParts[1] || '',
            period: textParts[2] || '',
            gpa: textParts[3] || '',
            focus: textParts[4] || ''
          };
          profileInfo.education.push(education);
          console.log('학력 정보 추출:', education);
        }
      });
    }

    // 보유기술 추출
    const skillsSection = document.querySelector('section#skills, section[data-section="skills"]');
    console.log('기술 섹션 찾음:', skillsSection?.outerHTML);
    if (skillsSection) {
      const skillItems = skillsSection.querySelectorAll('.pvs-list__item--line-separated, .pvs-entity--padded');
      console.log('기술 항목들 찾음:', skillItems.length);
      skillItems.forEach((item, index) => {
        console.log(`기술 항목 ${index + 1}:`, item.outerHTML);
        const spans = item.querySelectorAll('span[aria-hidden="true"]');
        console.log(`기술 항목 ${index + 1}의 span들:`, Array.from(spans).map(el => el.outerHTML));
        const textParts = Array.from(spans)
          .map(span => span.textContent.trim())
          .filter(text => text);

        if (textParts.length > 0) {
          profileInfo.skills.push(textParts[0]);
          console.log('기술 추출:', textParts[0]);
        }
      });
    }

    console.log('프로필 정보 추출 완료:', profileInfo);
    return { success: true, profileInfo };
  } catch (error) {
    console.error('프로필 정보 추출 중 오류:', error);
    return { success: false, error: error.message };
  }
}

// 회사 정보 카드 표시
function showCompanyInfoCard(companyInfo, targetElement) {
  const existingCard = document.querySelector('.company-info-card');
  if (existingCard) existingCard.remove();

  const card = document.createElement('div');
  card.className = 'company-info-card';
  card.innerHTML = `
    <button class="close-btn">×</button>
    <h2>${companyInfo.name}</h2>
    <div class="company-details">
      ${companyInfo.industry ? `<p><strong>산업:</strong> ${companyInfo.industry}</p>` : ''}
      ${companyInfo.description ? `<p><strong>설명:</strong> ${companyInfo.description}</p>` : ''}
    </div>
  `;

  card.querySelector('.close-btn').addEventListener('click', () => card.remove());

  document.body.appendChild(card);

  const buttonRect = targetElement.getBoundingClientRect();
  card.style.top = `${buttonRect.bottom + window.scrollY}px`;
  card.style.left = `${buttonRect.left + window.scrollX}px`;
}

// Glassdoor 정보 추출
async function extractGlassdoorInfo(companyName) {
  try {
    // 회사 평점
    const ratingElement = document.querySelector('.rating-average');
    const rating = ratingElement ? parseFloat(ratingElement.textContent) : null;

    // 급여 정보
    const salaryElement = document.querySelector('.salary-estimate');
    const salary = salaryElement ? salaryElement.textContent.trim() : null;

    // 리뷰 정보
    const reviews = [];
    const reviewElements = document.querySelectorAll('.review-item');
    reviewElements.forEach(element => {
      const ratingElement = element.querySelector('.rating');
      const contentElement = element.querySelector('.review-content');
      const dateElement = element.querySelector('.review-date');
      
      if (ratingElement && contentElement) {
        reviews.push({
          rating: parseFloat(ratingElement.textContent),
          content: contentElement.textContent.trim(),
          date: dateElement ? dateElement.textContent.trim() : '날짜 없음'
        });
      }
    });

    // 면접 경험
    const interviews = [];
    const interviewElements = document.querySelectorAll('.interview-item');
    interviewElements.forEach(element => {
      const difficultyElement = element.querySelector('.difficulty-rating');
      const processElement = element.querySelector('.interview-process');
      const dateElement = element.querySelector('.interview-date');
      
      if (processElement) {
        interviews.push({
          difficulty: difficultyElement ? parseFloat(difficultyElement.textContent) : null,
          process: processElement.textContent.trim(),
          date: dateElement ? dateElement.textContent.trim() : '날짜 없음'
        });
      }
    });

    return {
      success: true,
      glassdoorInfo: {
        rating,
        salary,
        reviews: reviews.slice(0, 5), // 최근 5개 리뷰만
        interviews: interviews.slice(0, 5) // 최근 5개 면접 경험만
      }
    };
  } catch (error) {
    console.error('Glassdoor 정보 추출 오류:', error);
    return {
      success: false,
      error: 'Glassdoor 정보를 추출하는 중 오류가 발생했습니다.'
    };
  }
}